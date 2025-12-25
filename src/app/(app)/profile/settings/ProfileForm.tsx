'use client'

import { ImageAdd02Icon } from '@/components/Icons'
import Avatar from '@/shared/Avatar'
import ButtonPrimary from '@/shared/ButtonPrimary'
import { Divider } from '@/shared/divider'
import { Field, Label } from '@/shared/fieldset'
import Input from '@/shared/Input'
import Select from '@/shared/Select'
import Textarea from '@/shared/Textarea'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateProfile } from './actions'

interface User {
    id: string
    name: string | null
    email: string | null
    image?: string | null
    avatar: string | null
    gender: string | null
    dateOfBirth: Date | null
    address: string | null
    phone: string | null
    bio: string | null
}

interface ProfileFormProps {
    user: User
}

export default function ProfileForm({ user }: ProfileFormProps) {
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [avatar, setAvatar] = useState(user.avatar || user.image || '') // Fallback to image if avatar is null

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('files', files[0])

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            if (res.ok) {
                const data = await res.json()
                if (data.url || (data.urls && data.urls[0])) {
                    setAvatar(data.url || data.urls[0])
                    toast.success('Đã tải ảnh lên')
                }
            } else {
                toast.error('Lỗi khi tải ảnh')
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async (formData: FormData) => {
        setLoading(true)
        // Append avatar if it was changed locally
        if (avatar) {
            formData.set('avatar', avatar)
        }

        try {
            const result = await updateProfile(formData)
            if (result.success) {
                toast.success('Cập nhật thông tin thành công!')
            } else {
                toast.error(result.error || 'Có lỗi xảy ra')
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
                Thông tin tài khoản
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
                Quản lý thông tin hồ sơ và bảo mật tài khoản của bạn
            </p>

            <form action={handleSubmit}>
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Left Column: Avatar */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group size-32 overflow-hidden rounded-full ring-4 ring-primary-50 dark:ring-primary-900/20">
                                <Avatar src={avatar || undefined} className="size-full" />
                                <div className={`absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/50 text-white transition-opacity duration-200 ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {uploading ? (
                                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <ImageAdd02Icon className="h-6 w-6 mb-1" />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Đổi ảnh</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                            </div>
                            <div className="text-center max-w-[200px]">
                                <h3 className="text-sm font-medium text-neutral-900 dark:text-white">Ảnh đại diện</h3>
                                <p className="text-xs text-neutral-500 mt-1">Hỗ trợ PNG, JPG, JPEG (Tối đa 5MB)</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Form Fields */}
                    <div className="flex-grow space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <Field>
                                <Label>Họ và tên</Label>
                                <Input
                                    className="mt-1.5 !rounded-xl"
                                    name="name"
                                    defaultValue={user.name || ''}
                                    placeholder="Nhập tên hiển thị"
                                />
                            </Field>
                            <Field>
                                <Label>Giới tính</Label>
                                <Select className="mt-1.5 !rounded-xl" name="gender" defaultValue={user.gender || 'Male'}>
                                    <option value="Male">Nam</option>
                                    <option value="Female">Nữ</option>
                                    <option value="Other">Khác</option>
                                </Select>
                            </Field>
                        </div>

                        <Field>
                            <Label>Email</Label>
                            <Input
                                className="mt-1.5 !rounded-xl bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                                name="email"
                                defaultValue={user.email || ''}
                                disabled
                            />
                            <p className="text-xs text-neutral-500 mt-1">Email không thể thay đổi</p>
                        </Field>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Field>
                                <Label>Ngày sinh</Label>
                                <Input
                                    className="mt-1.5 !rounded-xl"
                                    type="date"
                                    name="dateOfBirth"
                                    defaultValue={user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''}
                                />
                            </Field>
                            <Field>
                                <Label>Số điện thoại</Label>
                                <Input
                                    className="mt-1.5 !rounded-xl"
                                    name="phone"
                                    defaultValue={user.phone || ''}
                                    placeholder="Nhập số điện thoại"
                                />
                            </Field>
                        </div>

                        <Field>
                            <Label>Địa chỉ</Label>
                            <Input
                                className="mt-1.5 !rounded-xl"
                                name="address"
                                defaultValue={user.address || ''}
                                placeholder="Nhập địa chỉ của bạn"
                            />
                        </Field>

                        <Field>
                            <Label>Giới thiệu</Label>
                            <Textarea
                                className="mt-1.5 !rounded-xl"
                                name="bio"
                                defaultValue={user.bio || ''}
                                rows={4}
                                placeholder="Viết vài dòng giới thiệu về bản thân..."
                            />
                        </Field>

                        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6 flex justify-end">
                            <ButtonPrimary type="submit" disabled={loading || uploading} className="!rounded-xl px-8">
                                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </ButtonPrimary>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}
