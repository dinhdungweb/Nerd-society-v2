'use server'

import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher-server'

// Pusher authentication endpoint cho private channels
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const socketId = formData.get('socket_id') as string
        const channel = formData.get('channel_name') as string

        if (!socketId || !channel) {
            return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
        }

        // Kiểm tra quyền truy cập channel
        // Private channels bắt đầu bằng 'private-'
        if (channel.startsWith('private-admin')) {
            // Chỉ admin/staff mới được subscribe admin channels
            // TODO: Verify session role here
        }

        // Authorize the channel
        const authResponse = pusherServer.authorizeChannel(socketId, channel)

        return NextResponse.json(authResponse)
    } catch (error) {
        console.error('Pusher auth error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
