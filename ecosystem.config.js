module.exports = {
    apps: [
        {
            name: 'nerd-society',
            script: 'npm',
            args: 'start',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '3G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
        },
    ],
}
