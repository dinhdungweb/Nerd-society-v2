import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Avatar from '@/shared/Avatar'
import ButtonPrimary from '@/shared/ButtonPrimary'
import { Divider } from '@/shared/divider'
import { Field, Label } from '@/shared/fieldset'
import Input from '@/shared/Input'
import Select from '@/shared/Select'
import Textarea from '@/shared/Textarea'
import T from '@/utils/getT'
import { ImageAdd02Icon } from '@/components/Icons'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Account Settings',
}

export default async function SettingsPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    })

    if (!user) redirect('/login')

    async function updateProfile(formData: FormData) {
        'use server'

        const name = formData.get('name') as string
        const gender = formData.get('gender') as string
        const email = formData.get('email') as string
        const dateOfBirthStr = formData.get('dateOfBirth') as string
        const address = formData.get('address') as string
        const phone = formData.get('phone') as string
        const bio = formData.get('bio') as string

        const dateOfBirth = dateOfBirthStr ? new Date(dateOfBirthStr) : null

        await prisma.user.update({
            where: { id: session?.user?.id },
            data: {
                name,
                gender,
                // email, // Usually fetching email but verifying changes is complex, keeping simple for now
                dateOfBirth,
                address,
                phone,
                bio,
            },
        })

        revalidatePath('/profile/settings')
    }

    return (
        <div>
            <h1 className="text-3xl font-semibold">{T['accountPage']['Account information']}</h1>
            <Divider className="my-8 w-14!" />

            <form action={updateProfile} className="flex flex-col md:flex-row">
                <div className="flex shrink-0 items-start">
                    <div className="relative flex overflow-hidden rounded-full">
                        <Avatar src={user.avatar || undefined} className="h-32 w-32" />
                        <div className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/60 text-neutral-50">
                            <ImageAdd02Icon className="h-6 w-6" />
                            <span className="mt-1 text-xs">{T['accountPage']['Change Image']}</span>
                        </div>
                        <input type="file" className="absolute inset-0 cursor-pointer opacity-0" />
                    </div>
                </div>

                <div className="mt-10 max-w-3xl grow space-y-6 md:mt-0 md:ps-16">
                    <Field>
                        <Label>{T['accountPage']['Name']}</Label>
                        <Input className="mt-1.5" name="name" defaultValue={user.name || ''} />
                    </Field>

                    <Field>
                        <Label>{T['accountPage']['Gender']}</Label>
                        <Select className="mt-1.5" name="gender" defaultValue={user.gender || 'Male'}>
                            <option value="Male">{T['accountPage']['Male']}</option>
                            <option value="Female">{T['accountPage']['Female']}</option>
                            <option value="Other">{T['accountPage']['Other']}</option>
                        </Select>
                    </Field>

                    <Field>
                        <Label>{T['accountPage']['Email']}</Label>
                        <Input className="mt-1.5" name="email" defaultValue={user.email || ''} disabled />
                    </Field>

                    <Field className="max-w-lg">
                        <Label>{T['accountPage']['Date of birth']}</Label>
                        <Input
                            className="mt-1.5"
                            type="date"
                            name="dateOfBirth"
                            defaultValue={user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''}
                        />
                    </Field>

                    <Field>
                        <Label>{T['accountPage']['Addess']}</Label>
                        <Input className="mt-1.5" name="address" defaultValue={user.address || ''} />
                    </Field>

                    <Field>
                        <Label>{T['accountPage']['Phone number']}</Label>
                        <Input className="mt-1.5" name="phone" defaultValue={user.phone || ''} />
                    </Field>

                    <Field>
                        <Label>{T['accountPage']['About you']}</Label>
                        <Textarea className="mt-1.5" name="bio" defaultValue={user.bio || ''} />
                    </Field>

                    <div className="pt-4">
                        <ButtonPrimary type="submit">{T['accountPage']['Update information']}</ButtonPrimary>
                    </div>
                </div>
            </form>
        </div>
    )
}
