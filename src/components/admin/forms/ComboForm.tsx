'use client'

import { Button } from '@/shared/Button'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Combo {
    id: string
    name: string
    duration: number
    price: number
    description: string | null
    features: string[]
    icon: string | null
    isPopular: boolean
    isActive: boolean
    sortOrder: number
}

interface ComboFormProps {
    combo?: Combo | null
    onSuccess?: () => void
    onCancel?: () => void
}

export default function ComboForm({ combo, onSuccess, onCancel }: ComboFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [features, setFeatures] = useState<string[]>([''])

    const isEditing = !!combo

    // Pre-fill form when editing
    useEffect(() => {
        if (combo) {
            setFeatures(combo.features.length > 0 ? combo.features : [''])
        }
    }, [combo])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get('name'),
            duration: formData.get('duration'),
            price: formData.get('price'),
            description: formData.get('description'),
            icon: formData.get('icon') || null,
            features: features.filter(f => f.trim() !== ''),
            isPopular: formData.get('isPopular') === 'on',
            isActive: formData.get('isActive') === 'on',
            sortOrder: formData.get('sortOrder') || 0,
        }

        try {
            const url = isEditing ? `/api/admin/combos/${combo.id}` : '/api/admin/combos'
            const method = isEditing ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (res.ok) {
                router.refresh()
                onSuccess?.()
            } else {
                const error = await res.json()
                alert(error.error || 'Lỗi lưu combo')
            }
        } catch (error) {
            console.error(error)
            alert('Có lỗi xảy ra')
        } finally {
            setLoading(false)
        }
    }

    const addFeature = () => setFeatures([...features, ''])
    const updateFeature = (idx: number, val: string) => {
        const newFeatures = [...features]
        newFeatures[idx] = val
        setFeatures(newFeatures)
    }
    const removeFeature = (idx: number) => {
        if (features.length > 1) {
            setFeatures(features.filter((_, i) => i !== idx))
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tên Combo</label>
                <input
                    name="name"
                    defaultValue={combo?.name || ''}
                    required
                    className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Thời lượng (phút)</label>
                    <input
                        type="number"
                        name="duration"
                        defaultValue={combo?.duration || ''}
                        required
                        className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Giá (VND)</label>
                    <input
                        type="number"
                        name="price"
                        defaultValue={combo?.price || ''}
                        required
                        className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Icon (tùy chọn)</label>
                    <select
                        name="icon"
                        defaultValue={combo?.icon || ''}
                        className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                    >
                        <option value="">Mặc định</option>
                        <option value="ClockIcon">Đồng hồ</option>
                        <option value="FireIcon">Lửa (Hot)</option>
                        <option value="BookOpenIcon">Sách</option>
                        <option value="SunIcon">Mặt trời</option>
                        <option value="MoonIcon">Mặt trăng</option>
                        <option value="CoffeeIcon">Cà phê</option>
                        <option value="PresentationChartBarIcon">Phòng họp</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Thứ tự hiển thị</label>
                    <input
                        type="number"
                        name="sortOrder"
                        defaultValue={combo?.sortOrder || 0}
                        className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Mô tả ngắn</label>
                <textarea
                    name="description"
                    defaultValue={combo?.description || ''}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Tính năng nổi bật</label>
                {features.map((feature, idx) => (
                    <div key={idx} className="mb-2 flex gap-2">
                        <input
                            value={feature}
                            onChange={(e) => updateFeature(idx, e.target.value)}
                            className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                            placeholder={`Tính năng ${idx + 1}`}
                        />
                        {features.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeFeature(idx)}
                                className="px-2 text-red-500 hover:text-red-700"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
                <button type="button" onClick={addFeature} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Thêm dòng</button>
            </div>

            <div className="flex gap-6">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        name="isPopular"
                        defaultChecked={combo?.isPopular || false}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Phổ biến (Hot)</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={combo?.isActive ?? true}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Hoạt động</span>
                </label>
            </div>



            <div className="flex justify-between pt-4">
                <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo Combo'}
                    </Button>
                    <Button type="button" outline onClick={onCancel}>Hủy</Button>
                </div>

                {isEditing && (
                    <button
                        type="button"
                        onClick={async () => {
                            if (confirm('Bạn có chắc chắn muốn xóa combo này? Hành động này không thể hoàn tác.')) {
                                setLoading(true)
                                try {
                                    const res = await fetch(`/api/admin/combos/${combo.id}`, {
                                        method: 'DELETE',
                                    })
                                    if (res.ok) {
                                        router.refresh()
                                        onSuccess?.()
                                    } else {
                                        alert('Lỗi xóa combo')
                                    }
                                } catch (error) {
                                    console.error(error)
                                    alert('Có lỗi xảy ra')
                                } finally {
                                    setLoading(false)
                                }
                            }
                        }}
                        className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    >
                        Xóa
                    </button>
                )}
            </div>
        </form >
    )
}
