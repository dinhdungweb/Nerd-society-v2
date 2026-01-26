import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ButtonCircleProps, ButtonCircle as ButtonCircleUI } from './Button'

const ButtonClose = ({ className, color, outline, plain, ...props }: ButtonCircleProps & {}) => {
  return (
    <ButtonCircleUI plain {...props} className={className}>
      <span className="sr-only">close</span>
      <HugeiconsIcon icon={Cancel01Icon} size={20} color="currentColor" strokeWidth={1.5} />
    </ButtonCircleUI>
  )
}

export default ButtonClose
