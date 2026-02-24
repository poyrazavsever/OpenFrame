import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth, checkProjectAccess } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { cleanupProjectMediaFiles } from '@/lib/r2-cleanup';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';

type RouteParams = { params: Promise<{ projectId: string }> };

// GET /api/projects/[projectId] - Get a single project
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        const { projectId } = await params;

        // Parse pagination params
        const searchParams = request.nextUrl.searchParams;
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

        const project = await db.project.findUnique({
            where: { id: projectId },
            include: {
                owner: { select: { id: true, name: true, image: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, image: true } },
                    },
                },
                videos: {
                    orderBy: { position: 'asc' },
                    skip: offset,
                    take: limit,
                    include: {
                        versions: {
                            where: { isActive: true },
                            orderBy: { versionNumber: 'desc' },
                            take: 1,
                            select: {
                                id: true,
                                thumbnailUrl: true,
                                duration: true,
                                versionNumber: true,
                                _count: { select: { comments: true } },
                            },
                        },
                        _count: { select: { versions: true } },
                    },
                },
                _count: { select: { videos: true, members: true, shareLinks: true } },
            },
        });

        if (!project) {
            return apiErrors.notFound('Project');
        }

        const access = await checkProjectAccess(project, session?.user?.id);
        if (!access.hasAccess) {
            return apiErrors.forbidden('Access denied');
        }

        const response = successResponse(project);
        return withCacheControl(response, 'private, max-age=30, stale-while-revalidate=60');
    } catch (error) {
        console.error('Error fetching project:', error);
        return apiErrors.internalError('Failed to fetch project');
    }
}

// PATCH /api/projects/[projectId] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        const { projectId } = await params;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        const projectAccessTarget = await db.project.findUnique({
            where: { id: projectId },
            select: { id: true, ownerId: true, workspaceId: true, visibility: true },
        });
        const access = projectAccessTarget
            ? await checkProjectAccess(projectAccessTarget, session.user.id, { intent: 'manage' })
            : null;
        if (!access?.canEdit) {
            return apiErrors.forbidden('Access denied');
        }

        const body = await request.json();
        const { name, description, visibility } = body;

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (visibility !== undefined) updateData.visibility = visibility;

        const project = await db.project.update({
            where: { id: projectId },
            data: updateData,
            include: {
                owner: { select: { id: true, name: true, image: true } },
                _count: { select: { videos: true, members: true } },
            },
        });

        const response = successResponse(project);
        return withCacheControl(response, 'private, no-store');
    } catch (error) {
        console.error('Error updating project:', error);
        return apiErrors.internalError('Failed to update project');
    }
}

// DELETE /api/projects/[projectId] - Delete a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        const { projectId } = await params;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        const project = await db.project.findUnique({
            where: { id: projectId },
            select: { id: true, ownerId: true, workspaceId: true, visibility: true },
        });
        if (!project) {
            return apiErrors.notFound('Project');
        }

        const access = await checkProjectAccess(project, session.user.id, { intent: 'delete' });
        if (!access.canDelete) {
            return apiErrors.forbidden('Only the project owner can delete it');
        }

        // Clean up voice files from R2 before cascade delete removes comment rows
        await cleanupProjectMediaFiles(projectId);

        await db.project.delete({ where: { id: projectId } });

        const response = successResponse({ message: 'Project deleted' });
        return withCacheControl(response, 'private, no-store');
    } catch (error) {
        console.error('Error deleting project:', error);
        return apiErrors.internalError('Failed to delete project');
    }
}
