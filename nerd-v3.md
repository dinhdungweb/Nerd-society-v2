1) Mục tiêu sản phẩm
Study/Work Date @ Nerd = một product riêng giúp:
Match khách có nhu cầu “study buddy / work buddy / open to date”


Tăng trải nghiệm tại quán (reserve bàn + kit trên bàn)


Mở rộng tệp khách mới (marketing “Study Date”)


Giảm rủi ro/no-show bằng quy trình confirm + deposit (tùy chọn)


2) User roles
User/Member (khách): đăng ký thông tin date + availability tuần tới, nhận match, confirm/cancel, feedback sau buổi.


Admin (ops): duyệt/chạy matching, cấu hình slot, theo dõi report/no-show.


Staff (thu ngân): xem lịch date trong ngày, reserve bàn, check-in theo SĐT/QR, xử lý đến muộn/no-show.



3) Luồng chính (MVP – weekly batch matching)
3.1 Onboarding
Trang đăng ký thành viên hiện có → thêm section “Date info” (opt-in).


Sau khi opt-in, user vào Week Planner (có option link với google calendar của khách đc k để khách có thể tiện check planner mà k cần vào web?): chọn chi nhánh + thời gian sẽ đến Nerd trong tuần tới.


3.2 Chốt match theo tuần (khuyến nghị để dễ vận hành)
Deadline: Thứ Bảy 23:59 (user chốt lịch tuần tới)


Chủ nhật 18:00–22:00: hệ thống/admin chạy matching


Gửi notification/email: “Bạn đã có match” + link confirm


3.3 Confirm
User A và B đều phải Confirm trong thời hạn (ví dụ 6–12h) mới “locked”.


Nếu 1 bên không confirm → match rơi, đưa user trở lại pool.


3.4 Ngày hẹn (ops tại quán)
Staff mở calendar nội bộ (giống lịch phòng meeting) để xem slot date


T-30’ reserve bàn 2 ghế, để “Reserved Study Date”


Check-in bằng SĐT/QR membership → staff xác nhận “Bạn có match hôm nay” → dẫn vào bàn


Sau buổi: gửi feedback + “want to meet again?”



4) Phần form “Date info” (cần thêm field để matching)
Các field cơ bản đã có: tên, tuổi, SĐT, trường, giới tính, mục đích tới Nerd, giới thiệu bản thân (optional).
Date info (opt-in)
4.1 Intent / mục tiêu match
Seeking: study_buddy | work_buddy | open_to_date (multi-select hoặc single)


“Date level”: focus_only | 50_50 | date_heavy (3 mức)


Preferred format: 1_1 | group_3_4 (optional)


4.2 Work style / vibe
Mode: silent_90 | pomodoro | casual_chat (single)


Interaction level: low | medium | high


Environment: quiet | light_music_ok | dont_care (optional)


Intro/Extro: intro | ambi | extro (optional)


4.3 Chủ đề / mục tiêu tuần tới
Primary focus: dropdown (IELTS/HSK/JLPT/thesis/portfolio/Excel/coding/design/startup/other)


Support preference: just_presence | quick_review_10m | skill_swap (optional)


4.4 Match filters + safety
Age range desired: min/max (optional)


Share preference: minimal_profile_only (default true) / share_more_contact_optional


Agree to Code of Conduct (required)


Blacklist by phone (optional)


Report consent (required acknowledgement)



5) Week Planner (availability) + chi nhánh
MVP nên làm dạng “slot picker” thay vì tích hợp sâu Google Calendar của khách.
User chọn
Branch: Tay Son | HTM (tag bắt buộc)


Slots tuần tới: chọn các khung cố định (config bởi admin), ví dụ:


09–12 / 14–17 / 19–22 / hoặc theo combo Bee/Owl/Fox / Báo đêm…


Optional: “flexible +/- 30 phút” (nếu cần)


Admin cấu hình
Danh sách slot theo từng chi nhánh


Số lượng match tối đa/slot (capacity) để tránh overbook



6) Matching logic (heuristic MVP)
Dev chỉ cần build thuật toán đơn giản + có khả năng override bằng admin.
6.1 Điều kiện match tối thiểu
Cùng branch


Có ít nhất 1 slot trùng


Compatible về: seeking + work style (ưu tiên)


Không nằm trong blacklist/report ban


6.2 Scoring gợi ý
+3 cùng mode (silent/pomodoro/casual)


+2 cùng primary focus / chủ đề


+2 cùng interaction level


+1 cùng trường/ngành (optional)


-∞ nếu violate filter (age range, blacklist)
 Chọn match score cao nhất cho mỗi user theo từng slot.


6.3 Double opt-in
Match chỉ “locked” khi cả hai confirm.



7) Notification / Email: gửi gì?
Mức thông tin gửi trong email/noti (khuyến nghị minimal để an toàn)
Time + branch đã match


“Bite-size profile” của người kia:


tuổi, giới tính (nếu user cho phép)


trường (optional)


work mode (silent/pomodoro)


2–3 fun facts từ phần giới thiệu


CTA: Confirm / Reschedule / Cancel (deadline)


Không gửi ngay
SĐT/IG trực tiếp của nhau (chỉ mở nếu cả hai “meet again” hoặc cả hai đồng ý share).



8) Ops calendar nội bộ (để staff vận hành)
Tạo Google Calendar “Nerd Study Date” (hoặc calendar module trong admin panel; MVP có thể dùng Google Calendar API sau).
Khi match locked → hệ thống tạo event:
Title: SD | TS | 19:00-22:00 | Pair #123


Description: masked phone 09xx… + work mode + notes


Location/Branch tag


Color theo branch


Staff dashboard MVP
View “Today’s matches” theo chi nhánh


Search theo SĐT → thấy match nào hôm nay


Check-in status: not_arrived | arrived_A | arrived_B | both_arrived | no_show



9) On-site experience (kit trên bàn)
Khuyến nghị làm Study Date Kit để tăng trải nghiệm + viral:
Table tent: chọn “Silent / Pomodoro” + QR feedback + rules (no pressure)


Goal sheet: mỗi người ghi 1–2 mục tiêu hôm nay


3 icebreaker prompts ngắn (không sến)
 Dev không cần code, chỉ cần asset/QR link.



10) After-care / Feedback flow
Sau slot (hoặc cuối ngày) gửi link feedback:
Rating match 1–5


“Want to meet again?” Yes/No/Maybe


Safety: “felt respected?” + report
 Nếu cả hai Yes → mở option:


share contact (opt-in) hoặc đề xuất book buổi 2



11) Pricing / business rules (để dev biết cần module gì)
MVP pricing đơn giản:
Khách vẫn mua combo ghế như bình thường (Bee/Owl/Fox…)


Matching fee: 0đ trong beta hoặc 19k–29k/người/match (config)


Optional deposit chống no-show: 30k–50k (trừ vào bill khi check-in)


Beta mode
Có flag “beta_free_matching=true”


Copy hiển thị: “Study Date đang beta – miễn phí matching, slot giới hạn”



12) Admin panel (tối thiểu cần có)
Quản lý users (opt-in date / ban / blacklist)


Cấu hình slot theo branch + capacity


Chạy matching (manual button) + xem kết quả + override


Gửi noti/email template


Xem report/no-show stats



13) Phase roadmap (để dev estimate)
Phase 1 (Web MVP – 1–3 tuần tùy dev)
Date info form + Week planner slot picker


Matching batch + confirm links


Admin basic (run match, view matches)


Staff view (today list + search SĐT)


Email notifications


Phase 2
Auto create Google Calendar events (API)


Deposit/payment integration (VNPay/MoMo/Stripe tùy)


Real-time matching (optional) + queue + capacity


Phase 3
Subscription, chat, richer profiles, analytics



14) Feasibility notes / assumptions
Ưu tiên weekly matching trước, tránh real-time phức tạp.


Availability dùng slot cố định để dễ match + dễ reserve chỗ.


Calendar khách (Google Calendar/Trello) chưa cần ở MVP; chỉ cần calendar nội bộ Nerd.

