import { prisma } from '@/lib/prisma'
import {
    ClockIcon,
    CurrencyDollarIcon,
    PencilIcon,
    StarIcon,
} from '@heroicons/react/24/outline'
import AddComboWrapper from '@/components/admin/AddComboWrapper'

async function getCombos() {
    return prisma.combo.findMany({
        orderBy: { sortOrder: 'asc' },
    })
}

export default async function CombosPage() {
    const combos = await getCombos()

    return (
        <div>
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý Combo</h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        Quản lý các gói dịch vụ
                    </p>
                </div>
                <AddComboWrapper />
            </div>

            {/* Combos Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {combos.map((combo) => (
                    <div
                        key={combo.id}
                        className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-neutral-900"
                    >
                        {/* Popular badge */}
                        {combo.isPopular && (
                            <div className="absolute right-4 top-4">
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    <StarIcon className="size-3" />
                                    Phổ biến
                                </span>
                            </div>
                        )}

                        {/* Active/Inactive status */}
                        <div className={`mb-4 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${combo.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {combo.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                        </div>

                        {/* Combo info */}
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                            {combo.name}
                        </h3>

                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                            {combo.description}
                        </p>

                        {/* Details */}
                        <div className="mt-4 flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                                <ClockIcon className="size-4" />
                                <span>{combo.duration >= 60 ? `${combo.duration / 60}h` : `${combo.duration}p`}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                                <CurrencyDollarIcon className="size-4" />
                                <span>{new Intl.NumberFormat('vi-VN').format(combo.price)}đ</span>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="mt-4">
                            <ul className="space-y-1">
                                {combo.features.slice(0, 3).map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        <span className="size-1 rounded-full bg-primary-500" />
                                        {feature}
                                    </li>
                                ))}
                                {combo.features.length > 3 && (
                                    <li className="text-sm text-neutral-400 dark:text-neutral-500">
                                        +{combo.features.length - 3} more
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* Stats */}
                        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {combo.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                            </p>
                        </div>

                        {/* Edit button */}
                        <button className="cursor-pointer absolute right-4 bottom-4 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-neutral-800 dark:text-neutral-300">
                            <PencilIcon className="size-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
