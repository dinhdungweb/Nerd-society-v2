# Nerd Night — Đặc tả UX (Draft cho Dev)

## 1\. Bối cảnh & phạm vi

Thêm module "Nerd Night" vào website hiện có của Nerd Society. Website đã có sẵn hệ thống tài khoản, nên module này **không tạo lại luồng đăng ký/đăng nhập** — chỉ cần user đã đăng nhập là dùng được.

4 tính năng cần thêm:

1. Đăng ký chủ đề mình sẽ nói (gắn theo 1 buổi cụ thể)  
2. Đăng ký tham gia buổi khi admin mở lịch  
3. Thanh toán qua mã QR  
4. Review lại buổi sau khi tham dự

## 2\. Vai trò & giả định

| Vai trò | Mô tả |
| :---- | :---- |
| **End-user** | Tài khoản đã có sẵn trên site. Xem lịch, đăng ký tham gia, đăng ký nói, thanh toán, review. |
| **Admin/Staff** | Nhiều người cùng quản lý (không chỉ 1 admin). Mở lịch buổi, duyệt thanh toán, đóng buổi. Cần phân quyền admin trong hệ thống tài khoản hiện có (role \= admin/staff), không cần cổng đăng nhập riêng. |

**Giả định cần dev xác nhận lại:**

- "Đăng ký chủ đề" gắn liền với 1 buổi cụ thể (user chọn buổi rồi mới đăng ký nói trong buổi đó), không phải một "kho chủ đề" độc lập tách rời khỏi lịch. Nếu ý tưởng thực tế là kho đề xuất chủ đề chung để admin duyệt trước rồi mới xếp vào buổi, cần tách thành 1 luồng riêng.  
- Mỗi user chỉ đăng ký participation 1 lần / 1 buổi (không cho đăng ký nhiều slot).  
- Thanh toán là chuyển khoản qua VietQR tĩnh (không tích hợp cổng thanh toán tự động) — admin xác nhận thủ công sau khi nhận tiền.

## 3\. Dữ liệu cần thêm (mô tả nghiệp vụ, không phải schema)

**Session (Buổi Nerd Night)**

- Tên buổi (optional), ngày giờ, địa điểm (HTM/TS/khác), giá vé, số chỗ tối đa  
- Có mở đăng ký chủ đề không? Số suất nói tối đa  
- Ghi chú buổi (optional)  
- Trạng thái: `upcoming` / `done`

**Registration (Đăng ký của 1 user cho 1 buổi)**

- User, buổi, có đăng ký nói không → tên chủ đề \+ mô tả (nếu có)  
- Trạng thái thanh toán: `unpaid` → `pending` (đã bấm "đã chuyển khoản") → `confirmed` (admin duyệt)  
- Thời điểm đăng ký

**Review (1 user / 1 buổi đã done)**

- Số sao (1–5), nhận xét, thời điểm

**Cấu hình thanh toán (toàn hệ thống, admin set 1 lần)**

- Ngân hàng, số tài khoản, tên chủ tài khoản (để sinh QR VietQR)

## 4\. Luồng End-user

### 4.1 Danh sách buổi Nerd Night

- 2 tab: **Sắp diễn ra** / **Đã diễn ra**  
- Mỗi buổi hiển thị dạng thẻ: ngày giờ, địa điểm, giá vé, số chỗ còn trống (hoặc điểm đánh giá trung bình nếu đã done)  
- Badge nếu: còn suất đăng ký nói / hết chỗ

### 4.2 Chi tiết buổi — trạng thái "Sắp diễn ra"

- Thông tin buổi \+ danh sách diễn giả đã đăng ký (tên \+ tên chủ đề, hiển thị công khai để tạo hứng thú)  
- Nếu user **chưa đăng ký**:  
  - Nếu buổi có mở đăng ký chủ đề và còn suất → checkbox "Tôi muốn đăng ký nói" → hiện field tên chủ đề \+ mô tả ngắn  
  - Nút "Đăng ký tham gia — \[giá vé\]"  
  - Nếu hết chỗ → disable, hiện thông báo hết chỗ  
- Nếu user **đã đăng ký** → hiện trạng thái đăng ký \+ khối thanh toán (mục 4.4) \+ nút huỷ đăng ký (chỉ cho phép huỷ khi chưa `confirmed`)

### 4.3 Đăng ký chủ đề nói

- Là 1 phần của form đăng ký tham gia (không phải luồng tách riêng), field: tên chủ đề (bắt buộc nếu tick), mô tả ngắn (optional)  
- Nếu suất nói vừa hết ngay lúc submit → tự động chuyển thành đăng ký tham gia thường (không nói), báo cho user biết

### 4.4 Thanh toán QR

- Sau khi đăng ký → hiện mã QR VietQR (sinh từ cấu hình ngân hàng của admin \+ số tiền \+ nội dung chuyển khoản gợi ý, ví dụ mã định danh theo user)  
- Nút "Mình đã chuyển khoản" → đổi trạng thái sang **Chờ xác nhận**  
- Không có xác nhận tự động — admin duyệt thủ công (mục 5.3)  
- Khi `confirmed` → hiện trạng thái "Đã xác nhận", ẩn nút thanh toán

### 4.5 Chi tiết buổi — trạng thái "Đã diễn ra" (Review)

- Nếu user có đăng ký buổi này và chưa review → hiện form chọn sao (1–5) \+ nhận xét  
- Nếu đã review → hiện lại review của mình  
- Danh sách toàn bộ review công khai bên dưới (tên, sao, nhận xét) — dùng làm social proof

### 4.6 "Buổi của tôi" (trong trang tài khoản hiện có)

- Danh sách các buổi đã đăng ký \+ trạng thái thanh toán  
- Danh sách buổi đã qua cần review (nhắc user vào review)

## 5\. Luồng Admin/Staff

### 5.1 Cài đặt nhận thanh toán (làm 1 lần, sửa được sau)

- Chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản → dùng để sinh QR cho mọi buổi

### 5.2 Tạo & quản lý buổi

- Form tạo buổi: tên (optional), ngày giờ, địa điểm, giá vé, số chỗ tối đa, có mở đăng ký chủ đề không \+ số suất tối đa, ghi chú  
- Danh sách tất cả buổi (kể cả đã done), mỗi buổi hiện số đăng ký / số chỗ \+ số người đang chờ xác nhận thanh toán

### 5.3 Xác nhận thanh toán

- Trong trang chi tiết 1 buổi: danh sách người đăng ký (tên, liên hệ, chủ đề nếu có, trạng thái thanh toán)  
- Nút "Xác nhận" cho từng người ở trạng thái `pending` → chuyển `confirmed`  
- Cho phép "bỏ xác nhận" nếu admin bấm nhầm

### 5.4 Đóng buổi / mở review

- Nút "Đánh dấu đã diễn ra" → buổi chuyển `done`, mở tính năng review cho user  
- Có thể mở lại nếu đánh dấu nhầm  
- Xem điểm đánh giá trung bình \+ toàn bộ review của buổi

## 6\. Quy tắc nghiệp vụ

| Quy tắc | Chi tiết |
| :---- | :---- |
| Giới hạn chỗ | Không cho đăng ký khi số đăng ký \= số chỗ tối đa |
| Giới hạn suất nói | Field chọn "muốn nói" chỉ hiện khi buổi mở đăng ký chủ đề và còn suất |
| Huỷ đăng ký | Cho phép khi thanh toán chưa `confirmed`. Nếu đã `confirmed`, nên hướng user liên hệ admin thay vì tự huỷ (tránh mất tiền không rõ lý do) |
| Review | Chỉ mở cho buổi `done`, và chỉ cho user đã có đăng ký ở buổi đó. Mỗi user review 1 lần/buổi (edit được, không tạo trùng) |
| Trạng thái thanh toán | `unpaid` → `pending` → `confirmed`, đi 1 chiều trừ khi admin chủ động revert |

## 7\. Edge cases cần xử lý

- User đăng ký nói nhưng suất vừa hết do người khác đăng ký trước (race condition) → fallback thành tham gia thường \+ thông báo rõ  
- Admin đóng đăng ký chủ đề sau khi đã có người đăng ký nói → giữ nguyên các đăng ký cũ, chỉ chặn đăng ký mới  
- User huỷ đăng ký sau khi đã `pending` (đã chuyển khoản nhưng chưa xác nhận) → cần quy trình hoàn tiền thủ công, không tự động  
- Buổi bị đánh dấu `done` khi vẫn còn người `pending` chưa xác nhận → admin vẫn xác nhận được bình thường, không bị khoá  
- Hết chỗ nhưng vẫn còn suất nói → cho phép ẩn nút đăng ký tham gia thường nhưng vẫn xử lý nhất quán (tổng đăng ký \= tổng chỗ, kể cả người nói)

## 8\. Ngoài phạm vi (out of scope cho bản đầu)

- Cổng thanh toán tự động / webhook xác nhận chuyển khoản  
- Thông báo email/SMS/push khi có cập nhật trạng thái  
- Điểm danh check-in thực tế tại buổi (review hiện dựa trên đã đăng ký, không xác minh có mặt)  
- Hoàn tiền tự động  
- Kho đề xuất chủ đề độc lập ngoài buổi (xem giả định ở mục 2\)

