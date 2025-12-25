
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.VIETQR_WEBHOOK_SECRET || 'fallback_secret_for_dev'

/**
 * POST /api/payment/vietqr/api/token_generate
 * 
 * Endpoint required by VietQR.vn integration.
 * VietQR system calls this to get an access token before calling the webhook.
 * 
 * Auth: Basic Auth (Username/Password provided by USER in VietQR portal)
 */
export async function POST(request: NextRequest) {
    try {
        // Get Authorization header
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return NextResponse.json(
                { code: '401', desc: 'Unauthorized', data: null },
                { status: 401 }
            )
        }

        // Decode Basic Auth
        const base64Credentials = authHeader.split(' ')[1]
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
        const [username, password] = credentials.split(':')

        // Verify credentials
        // Credentials must be set in .env
        const expectedUser = process.env.VIETQR_PARTNER_USER;
        const expectedPass = process.env.VIETQR_PARTNER_PASS;

        if (!expectedUser || !expectedPass) {
            console.error('[VietQR Token] Missing VIETQR_PARTNER_USER or VIETQR_PARTNER_PASS in env');
            return NextResponse.json(
                { code: '500', desc: 'Server Misconfiguration', data: null },
                { status: 500 }
            )
        }

        if (username !== expectedUser || password !== expectedPass) {
            console.log('[VietQR Token] Auth failed for:', username)
            return NextResponse.json(
                { code: '401', desc: 'Invalid credentials', data: null },
                { status: 401 }
            )
        }

        // Generate Token
        // Token expires in 300 seconds (standard VietQR expectation)
        const token = jwt.sign(
            { user: username, type: 'vietqr_webhook' },
            JWT_SECRET,
            { expiresIn: 300 }
        )

        return NextResponse.json({
            code: '00',
            desc: 'Success',
            data: {
                access_token: token,
                token_type: 'Bearer',
                expires_in: 300
            }
        })

    } catch (error) {
        console.error('[VietQR Token] Error:', error)
        return NextResponse.json(
            { code: '500', desc: 'Internal Server Error', data: null },
            { status: 500 }
        )
    }
}
