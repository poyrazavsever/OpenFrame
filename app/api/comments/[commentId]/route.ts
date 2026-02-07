import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

type RouteParams = { params: Promise<{ commentId: string }> };

// GET /api/comments/[commentId]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        const { commentId } = await params;

        const comment = await db.comment.findUnique({
            where: { id: commentId },
            include: {
                author: { select: { id: true, name: true, image: true } },
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        author: { select: { id: true, name: true, image: true } },
                    },
                },
                version: {
                    include: {
                        video: {
                            include: {
                                project: {
                                    include: {
                                        members: { where: { userId: session?.user?.id || '' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        // Authorization check: verify user has access to the project
        const project = comment.version.video.project;
        const isOwner = session?.user?.id === project.ownerId;
        const isMember = project.members.length > 0;
        const isPublicOrLink = project.visibility !== 'PRIVATE';

        if (!isOwner && !isMember && !isPublicOrLink) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Strip internal project data from response
        const { version: _version, ...commentData } = comment;
        return NextResponse.json(commentData);
    } catch (error) {
        console.error('Error fetching comment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch comment' },
            { status: 500 }
        );
    }
}

// PATCH /api/comments/[commentId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        const { commentId } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const comment = await db.comment.findUnique({
            where: { id: commentId },
            include: {
                version: {
                    include: {
                        video: {
                            include: {
                                project: {
                                    include: {
                                        members: { where: { userId: session.user.id } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        const project = comment.version.video.project;
        const isOwner = project.ownerId === session.user.id;
        const isAuthor = comment.authorId === session.user.id;
        const isMember = project.members.length > 0;

        const body = await request.json();
        const { content, isResolved } = body;

        // Only author can edit content
        if (content !== undefined && !isAuthor) {
            return NextResponse.json(
                { error: 'Only the author can edit comment content' },
                { status: 403 }
            );
        }

        // Owner, author, or members can resolve/unresolve
        if (isResolved !== undefined && !isOwner && !isAuthor && !isMember) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (content !== undefined) updateData.content = content.trim();
        if (isResolved !== undefined) {
            updateData.isResolved = isResolved;
            updateData.resolvedAt = isResolved ? new Date() : null;
        }

        const updatedComment = await db.comment.update({
            where: { id: commentId },
            data: updateData,
            include: {
                author: { select: { id: true, name: true, image: true } },
                replies: {
                    include: {
                        author: { select: { id: true, name: true, image: true } },
                    },
                },
            },
        });

        return NextResponse.json(updatedComment);
    } catch (error) {
        console.error('Error updating comment:', error);
        return NextResponse.json(
            { error: 'Failed to update comment' },
            { status: 500 }
        );
    }
}

// DELETE /api/comments/[commentId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        const { commentId } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const comment = await db.comment.findUnique({
            where: { id: commentId },
            include: {
                version: {
                    include: {
                        video: { include: { project: true } },
                    },
                },
            },
        });

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        const isOwner = comment.version.video.project.ownerId === session.user.id;
        const isAuthor = comment.authorId === session.user.id;

        if (!isOwner && !isAuthor) {
            return NextResponse.json(
                { error: 'Only the author or project owner can delete this comment' },
                { status: 403 }
            );
        }

        await db.comment.delete({ where: { id: commentId } });

        return NextResponse.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        return NextResponse.json(
            { error: 'Failed to delete comment' },
            { status: 500 }
        );
    }
}
