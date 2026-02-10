import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ProjectMemberRole, WorkspaceMemberRole } from '@prisma/client';
import { rateLimit } from '@/lib/rate-limit';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';

type RouteParams = { params: Promise<{ projectId: string; videoId: string; versionId: string }> };

async function getVersionWithAccess(projectId: string, videoId: string, versionId: string, userId: string) {
    const version = await db.videoVersion.findFirst({
        where: { id: versionId, videoParentId: videoId },
        include: {
            video: {
                include: {
                    project: {
                        include: {
                            members: { where: { userId } },
                            workspace: {
                                include: {
                                    members: { where: { userId } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!version || version.video.projectId !== projectId) {
        return null;
    }

    const project = version.video.project;
    const isOwner = project.ownerId === userId;
    const membership = project.members[0];
    const workspaceMembership = project.workspace.members[0];
    const canEdit = isOwner ||
        membership?.role === ProjectMemberRole.ADMIN ||
        workspaceMembership?.role === WorkspaceMemberRole.ADMIN;

    return { version, canEdit, isOwner };
}

// PATCH /api/projects/[projectId]/videos/[videoId]/versions/[versionId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        const { projectId, videoId, versionId } = await params;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        const result = await getVersionWithAccess(projectId, videoId, versionId, session.user.id);
        if (!result) {
            return apiErrors.notFound('Version');
        }
        if (!result.canEdit) {
            return apiErrors.forbidden('Access denied');
        }

        const body = await request.json();
        const { duration, versionLabel, isActive } = body;

        const updateData: Record<string, unknown> = {};
        if (duration !== undefined) updateData.duration = duration;
        if (versionLabel !== undefined) updateData.versionLabel = versionLabel?.trim() || null;

        if (isActive === true) {
            // Deactivate all other versions, then activate this one
            await db.videoVersion.updateMany({
                where: { videoParentId: videoId },
                data: { isActive: false },
            });
            updateData.isActive = true;
        }

        const updated = await db.videoVersion.update({
            where: { id: versionId },
            data: updateData,
        });

        const response = successResponse(updated);
        return withCacheControl(response, 'private, no-store');
    } catch (error) {
        console.error('Error updating version:', error);
        return apiErrors.internalError('Failed to update version');
    }
}

// DELETE /api/projects/[projectId]/videos/[videoId]/versions/[versionId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        const { projectId, videoId, versionId } = await params;

        if (!session?.user?.id) {
            return apiErrors.unauthorized();
        }

        const result = await getVersionWithAccess(projectId, videoId, versionId, session.user.id);
        if (!result) {
            return apiErrors.notFound('Version');
        }
        if (!result.canEdit) {
            return apiErrors.forbidden('Access denied');
        }

        // Check there's more than one version — can't delete the last one
        const versionCount = await db.videoVersion.count({
            where: { videoParentId: videoId },
        });

        if (versionCount <= 1) {
            return apiErrors.badRequest('Cannot delete the only version. Delete the video instead.');
        }

        const wasActive = result.version.isActive;

        // Delete the version (cascades to comments)
        await db.videoVersion.delete({ where: { id: versionId } });

        // If the deleted version was active, activate the latest remaining one
        if (wasActive) {
            const latestVersion = await db.videoVersion.findFirst({
                where: { videoParentId: videoId },
                orderBy: { versionNumber: 'desc' },
            });
            if (latestVersion) {
                await db.videoVersion.update({
                    where: { id: latestVersion.id },
                    data: { isActive: true },
                });
            }
        }

        const response = successResponse({ message: 'Version deleted' });
        return withCacheControl(response, 'private, no-store');
    } catch (error) {
        console.error('Error deleting version:', error);
        return apiErrors.internalError('Failed to delete version');
    }
}
