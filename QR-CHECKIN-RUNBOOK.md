# QR Check-in Runbook

## Chuẩn bị scanner tại HTM và TS

- Kết nối scanner QR 2D bằng USB và chọn chế độ **USB HID Keyboard**.
- Bật **presentation/continuous mode**, hậu tố **Enter/CR** và **same-code suppression**.
- Đăng nhập tài khoản STAFF được gán đúng cơ sở, mở `/staff/subscription` toàn màn hình.
- Kiểm tra màn hình hiển thị đúng mã cơ sở trước khi quét.

## Cutover

1. Backup PostgreSQL và xuất session đang mở, công nợ, số dư ví, daily usage.
2. Chạy truy vấn preflight trong migration để tìm và xử lý mọi duplicate open session trước khi tạo unique index.
3. Chạy `npm run db:migrate:deploy`, sau đó `npm run db:backfill-qr` để xem dry-run và `npm run db:backfill-qr -- --apply` để áp dụng.
4. Đặt `CHECKIN_PROVIDER=qr`, `QR_SIGNING_SECRET` tối thiểu 32 byte ngẫu nhiên và restart ứng dụng.
5. Smoke test một khách tại HTM và một khách tại TS: check-in, quét lặp, check-out.

Không được bật MyTime polling và QR writer đồng thời. Session mở từ thẻ cũ vẫn checkout được bằng QR.

Nếu rollback trong 7 ngày: dừng ứng dụng QR writer trước, deploy lại release MyTime trước cutover, đặt provider `mytime`, rồi mới khởi động polling. Không chỉ đổi biến môi trường trên release QR hiện tại.

## Tiêu chí theo dõi

- API scan p95 dưới 1 giây; không có response thành công thiếu `MembershipScan`.
- Không có hơn một session mở trên mỗi subscriber.
- Theo dõi các outcome `INVALID_QR`, `BLOCK_CROSS_BRANCH`, `BLOCK_DEBT` và lỗi HTTP 5xx.
- Sau 7 ngày ổn định, xóa cấu hình rollback MyTime khỏi môi trường production.
