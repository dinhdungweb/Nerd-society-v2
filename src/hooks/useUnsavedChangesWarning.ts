'use client'

import { useEffect } from 'react'

export function useUnsavedChangesWarning(
    isDirty: boolean,
    message = 'Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?',
) {
    useEffect(() => {
        if (!isDirty) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }

        const handleDocumentClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            const target = event.target as Element | null
            const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
            if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

            const destination = new URL(anchor.href, window.location.href)
            if (destination.origin !== window.location.origin) return
            if (destination.pathname === window.location.pathname && destination.search === window.location.search) return

            if (!window.confirm(message)) {
                event.preventDefault()
                event.stopPropagation()
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('click', handleDocumentClick, true)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('click', handleDocumentClick, true)
        }
    }, [isDirty, message])
}
