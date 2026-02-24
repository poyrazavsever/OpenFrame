import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WorkspaceMemberRole } from '@prisma/client';
import { rateLimit } from '@/lib/rate-limit';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';

type RouteParams = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]/members - List members
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        const { workspaceId } = await params;
        const MAX_LIMIT = 100;
        const MAX_PAGE = 1000;
        const MAX_OFFSET = 10000;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        const searchParams = request.nextUrl.searchParams;
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        const pageRaw = pageParam === null ? 1 : Number(pageParam);
        if (!Number.isSafeInteger(pageRaw) || pageRaw < 1 || pageRaw > MAX_PAGE) {
            return apiErrors.badRequest('Invalid page. Must be a positive integer.');
        }

        const limitRaw = limitParam === null ? 20 : Number(limitParam);
        if (!Number.isSafeInteger(limitRaw) || limitRaw < 1 || limitRaw > MAX_LIMIT) {
            return apiErrors.badRequest('Invalid limit. Must be a positive integer between 1 and 100.');
        }

        const page = pageRaw;
        const limit = limitRaw;
        const skip = (page - 1) * limit;
        if (!Number.isSafeInteger(skip) || skip > MAX_OFFSET) {
            return apiErrors.badRequest('Invalid page range. Offset must be 10000 or less.');
        }

        const workspace = await db.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                members: { where: { userId: session.user.id } },
            },
        });

        if (!workspace) {
            return apiErrors.notFound('Workspace');
        }

        const isOwner = workspace.ownerId === session.user.id;
        const isMember = workspace.members.length > 0;

        if (!isOwner && !isMember) {
            return apiErrors.forbidden('Access denied');
        }

        const [members, total] = await Promise.all([
            db.workspaceMember.findMany({
                where: { workspaceId },
                include: {
                    user: { select: { id: true, name: true, email: true, image: true } },
                },
                orderBy: { createdAt: 'asc' },
                skip,
                take: limit,
            }),
            db.workspaceMember.count({
                where: { workspaceId },
            }),
        ]);

        // Include the owner as well
        const owner = await db.user.findUnique({
            where: { id: workspace.ownerId },
            select: { id: true, name: true, email: true, image: true },
        });

        const response = successResponse(
            { members, owner },
            200,
            {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        );
        return withCacheControl(response, 'private, max-age=60, stale-while-revalidate=120');
    } catch (error) {
        console.error('Error fetching workspace members:', error);
        return apiErrors.internalError('Failed to fetch members');
    }
}

// POST /api/workspaces/[workspaceId]/members - Invite a member
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const limited = await rateLimit(request, 'invite-member');
        if (limited) return limited;

        const session = await auth();
        const { workspaceId } = await params;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        // Check if user is owner or admin
        const workspace = await db.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: { where: { userId: session.user.id } } },
        });

        if (!workspace) {
            return apiErrors.notFound('Workspace');
        }

        const isOwner = workspace.ownerId === session.user.id;
        const isAdmin = workspace.members[0]?.role === WorkspaceMemberRole.ADMIN;

        if (!isOwner && !isAdmin) {
            return apiErrors.forbidden('Only workspace owners and admins can invite members');
        }

        const body = await request.json();
        const { email, role } = body;

        if (!email || typeof email !== 'string') {
            return apiErrors.badRequest('Email is required');
        }

        // Validate role
        const validRoles = ['ADMIN', 'COMMENTATOR'];
        const memberRole = validRoles.includes(role) ? role : 'COMMENTATOR';

        // Find user by email
        const userToInvite = await db.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!userToInvite) {
            const response = successResponse({ message: 'If the user exists, an invitation has been sent.' });
        return withCacheControl(response, 'private, no-store');
        }

        if (userToInvite.id === workspace.ownerId) {
            return apiErrors.badRequest('Cannot invite the workspace owner as a member');
        }

        // Check if already a member
        const existingMember = await db.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: userToInvite.id } },
        });

        if (existingMember) {
            return apiErrors.conflict('User is already a member of this workspace');
        }

        const member = await db.workspaceMember.create({
            data: {
                workspaceId,
                userId: userToInvite.id,
                role: memberRole as WorkspaceMemberRole,
            },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
            },
        });

        const response = successResponse(member, 201);
        return withCacheControl(response, 'private, no-store');
    } catch (error) {
        console.error('Error inviting workspace member:', error);
        return apiErrors.internalError('Failed to invite member');
    }
}
