'use client'

import { ChevronDownIcon, ClockIcon } from '@heroicons/react/24/outline'
import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'

interface TimeSlot {
    value: string
    label: string
    disabled?: boolean
}

interface TimeSelectProps {
    value: string
    onChange: (value: string) => void
    options: TimeSlot[]
    placeholder?: string
    disabled?: boolean
}

export default function TimeSelect({
    value,
    onChange,
    options,
    placeholder = 'Chọn giờ',
    disabled = false,
}: TimeSelectProps) {
    const selectedOption = options.find(o => o.value === value)

    return (
        <Listbox value={value} onChange={onChange} disabled={disabled}>
            <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-xl border border-neutral-300 bg-white py-3 pl-11 pr-10 text-left text-neutral-900 transition-all hover:border-primary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:border-primary-600">
                    <ClockIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    <span className={`block truncate ${!selectedOption ? 'text-neutral-400' : ''}`}>
                        {selectedOption?.label || placeholder}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronDownIcon className="size-5 text-neutral-400" aria-hidden="true" />
                    </span>
                </Listbox.Button>

                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800">
                        {options.map((option) => (
                            <Listbox.Option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                                className={({ active, disabled }) =>
                                    `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${disabled
                                        ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500'
                                        : active
                                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                            : 'text-neutral-900 dark:text-white'
                                    }`
                                }
                            >
                                {({ selected, disabled }) => (
                                    <>
                                        <span className={`block truncate ${selected ? 'font-semibold text-primary-600 dark:text-primary-400' : ''}`}>
                                            {option.label}
                                        </span>
                                        {selected && (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600 dark:text-primary-400">
                                                <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        )}
                                        {disabled && (
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400">
                                                <span className="text-xs">Đã đặt</span>
                                            </span>
                                        )}
                                    </>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </Transition>
            </div>
        </Listbox>
    )
}
