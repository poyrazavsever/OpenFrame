import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        const users = await db.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                _count: {
                    select: {
                        ownedWorkspaces: true,
                        projects: true,
                        comments: true,
                    }
                }
            }
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error('[ADMIN_USERS_GET]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
