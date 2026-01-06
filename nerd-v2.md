1) Membership / Nerd Member Profile
Mục tiêu: thu dữ liệu để cá nhân hoá + mở khóa theo dõi tích luỹ/nâng hạng.
UX/Flow
Trong Account có nút: “Hoàn thiện hồ sơ để nhận ưu đãi sinh nhật & theo dõi nâng hạng”
Khi chưa hoàn thiện profile → các trang “tích luỹ/nâng hạng/nerd coin” hiển thị empty state + CTA.
Fields:
Ngày sinh nhật 
Khu vực đang sinh sống 
Nghề nghiệp: Học sinh/sinh viên/ freelancer
Trường đang theo học
Mục đích tới:
Copy: chỉ nói chung chung (chưa công bố tier/benefit chi tiết).

2) Tier tracking / Nâng hạng (hiển thị cho khách)
Mục tiêu: khách xem được mình đang ở hạng nào + tiến độ lên hạng tiếp theo.
Cần có
Badge hạng hiện tại (Nerdie/Regular/Senior/Headmaster/Founders… hoặc tên bạn chốt sau)
Progress bar: “còn X lần ghé / Y₫ để lên hạng”
“Lịch sử tích luỹ” (tối thiểu: số lần/chi tiêu theo chu kỳ)
Logic
Xếp hạng dựa trên hành vi POS/booking (không dựa trên các câu hỏi profile)
Chu kỳ nên dùng rolling 90 ngày, nâng hạng realtime/batch daily.

.”

3) Booking Cancel / Reschedule + “Lưu cọc” → Credit (tự động)
Mục tiêu: giảm khối lượng hoàn tiền thủ công + giảm huỷ phút chót + giữ doanh thu.
V2 features
Khách tự thao tác trong account/booking detail:
Reschedule (đổi lịch)
Cancel
Hệ thống tự áp dụng policy theo mốc thời gian (>=2h / <2h)
Thay vì “hoàn tiền”, ưu tiên credit (wallet/hũ) để dùng lần sau
Policy bạn đang dùng (V1)
Cọc 50% giữ phòng
Huỷ/đổi trước 2h: lưu cọc
Trong 2h/no-show: mất cọc
Wallet/Credit tối giản (dev-friendly)
credit_balance
credit_transactions (booking_id, amount, reason, created_at, expiry)
Apply credit khi checkout booking lần sau


4) Guardrails theo cơ sở (Tây Sơn vs Hồ Tùng Mậu)
Mục tiêu: tránh khách chọn nhầm.
Tây Sơn hiện chưa có meeting/pod → banner:
“Meeting room/Pod – coming soon ✨ Hiện tại Tây Sơn phục vụ chỗ ngồi chung (walk-in).”
Nếu user cố chọn meeting/pod tại Tây Sơn → inline notice + nút chuyển sang HTM.

5) Hòm thư góp ý: nên làm “page luôn mở” + “góp ý theo ngữ cảnh”
Kết cấu tối ưu nhất:
Feedback page luôn mở (Footer: “Góp ý”)


Feedback prompt sau booking (hoặc trong booking success/ account) để thu “review chất lượng”


Lý do:
Page luôn mở → nhiều loại góp ý, nhưng đôi khi thiếu context


Sau booking → feedback cụ thể, có booking_id, xử lý nhanh hơn


Nên thiết kế Feedback page như thế nào (để không loạn + không bị spam)
Form tối giản 5 phần (khuyên dùng):
Bạn góp ý về (dropdown):


Không gian / Đồ uống / Nhân viên / Pod/Meeting / Website/Booking / Khác


Cơ sở (dropdown):


Tây Sơn / Hồ Tùng Mậu / Chưa ghé (chỉ góp ý online)


Mức độ (1–5) (optional)


Nội dung góp ý (required)


Bạn muốn Nerd liên hệ lại không? (checkbox)


Nếu có → Email/SĐT


Anti-spam (V1/V2 đều nên có):
reCAPTCHA (hoặc honeypot field)


rate limit theo IP


admin inbox có tag + filter


Anonymous hay bắt login?
Cho phép anonymous là tốt nhất để “dễ góp ý”


Nhưng nếu user đã login thì tự điền email/ID



6) Trang Tuyển dụng: nên làm page riêng luôn mở (rất nên)
Tuyển dụng mà “ẩn” sẽ mất ứng viên tốt.
Cấu trúc trang Tuyển dụng gọn và đủ dùng
Intro ngắn: Nerd là gì + vibe làm việc


Open positions (list card)


Mỗi job có:


Mô tả ngắn


Ca làm / địa điểm / yêu cầu chính


Quyền lợi


CTA: Ứng tuyển


Form ứng tuyển:


Họ tên


SĐT (khuyên bắt buộc cho tuyển dụng)


Email (optional)


Vị trí ứng tuyển


Cơ sở mong muốn


File CV/link (optional)


Câu hỏi ngắn: “Bạn có thể đi làm ca nào?”


Placement
Menu hoặc footer: “Tuyển dụng”


Nếu menu chật: để footer vẫn ổn


7) “Check chỗ ngồi chung” CTA (chat)
(Phần này là trải nghiệm, dù V1 bạn đã làm booking. Nếu chưa làm thì đưa vào V2.)
Placement
Trong trang booking/không gian:
“Chỗ ngồi chung walk-in, không đặt trước”
CTA phụ: “Chat để check hiện tại có đông không”
Tránh hiểu nhầm booking chỗ ngồi chung.
Uyên: phần check chỗ ngồi chung t đề xuất thế này 
Hướng 1: API camera (1 cam duy nhất) vào website, và unlock theo quyền lợi của hạng
Hướng 2: để thanh bar frequency như thế này 
