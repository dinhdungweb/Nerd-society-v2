type PrintMembershipQrOptions = {
  svg: SVGSVGElement
  memberName: string
  phone?: string | null
}

export function printMembershipQr({ svg, memberName, phone }: PrintMembershipQrOptions) {
  const printWindow = window.open('', 'membership-qr-print', 'width=520,height=700')

  if (!printWindow) {
    window.alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.')
    return
  }

  const document = printWindow.document
  document.title = `QR thành viên - ${memberName}`
  document.head.replaceChildren()
  document.body.replaceChildren()

  const style = document.createElement('style')
  style.textContent = `
    @page {
      size: A6 portrait;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      width: 100%;
      min-height: 100%;
    }

    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #ffffff;
      color: #171717;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .card {
      width: 100%;
      max-width: 89mm;
      padding: 6mm;
      border: 1px solid #ded8ce;
      border-radius: 4mm;
      text-align: center;
    }

    .brand {
      color: #6b5b45;
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.12em;
    }

    .label {
      margin-top: 4mm;
      color: #8a7657;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .name {
      margin: 1.5mm 0 0;
      font-size: 15pt;
      line-height: 1.2;
    }

    .phone {
      margin: 1mm 0 0;
      color: #666666;
      font-size: 9pt;
    }

    .qr {
      display: inline-flex;
      margin: 5mm auto 3mm;
      padding: 3mm;
      border: 1px solid #dedede;
      border-radius: 3mm;
      background: #ffffff;
    }

    .qr svg {
      display: block;
      width: 62mm;
      height: 62mm;
    }

    .instruction {
      margin: 2mm 0 0;
      font-size: 9pt;
      line-height: 1.45;
    }

    .note {
      margin: 2mm 0 0;
      color: #777777;
      font-size: 8pt;
    }

    @media screen {
      body {
        padding: 16px;
      }
    }
  `
  document.head.appendChild(style)

  const card = document.createElement('main')
  card.className = 'card'

  const brand = document.createElement('div')
  brand.className = 'brand'
  brand.textContent = 'NERD SOCIETY'

  const label = document.createElement('div')
  label.className = 'label'
  label.textContent = 'QR thành viên'

  const name = document.createElement('h1')
  name.className = 'name'
  name.textContent = memberName

  const qr = document.createElement('div')
  qr.className = 'qr'
  qr.appendChild(document.importNode(svg, true))

  const instruction = document.createElement('p')
  instruction.className = 'instruction'
  instruction.textContent = 'Đưa mã này vào máy quét tại quầy để check-in hoặc check-out.'

  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = 'Không chia sẻ mã QR này.'

  card.append(brand, label, name)

  if (phone) {
    const phoneLine = document.createElement('p')
    phoneLine.className = 'phone'
    phoneLine.textContent = phone
    card.appendChild(phoneLine)
  }

  card.append(qr, instruction, note)
  document.body.appendChild(card)

  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
  printWindow.requestAnimationFrame(() => {
    printWindow.requestAnimationFrame(() => {
      printWindow.focus()
      printWindow.print()
    })
  })
}
