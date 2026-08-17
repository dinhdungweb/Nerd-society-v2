# Thống kê chức năng và hướng dẫn sử dụng

Tài liệu này tổng hợp hai chức năng **Nerd Night** và **Monthly Beaver** trên hệ thống Nerd Society.

---

# 1. Nerd Night

## 1.1. Chức năng dành cho khách hàng

### Xem danh sách Nerd Night

**Công dụng:**

- Xem các đêm sắp diễn ra.
- Xem các đêm đã kết thúc.
- Xem chủ đề, thời gian, địa điểm và giá vé.
- Xem số chỗ người nghe và speaker còn lại.
- Xem điểm đánh giá của những đêm trước.

**Cách sử dụng:**

1. Truy cập `/nerd-night`.
2. Kéo xuống mục **Các đêm sắp tới**.
3. Chọn một đêm.
4. Nhấn **Xem & đăng ký**.

### Đăng ký tham dự

**Công dụng:**

- Giữ chỗ tham gia Nerd Night với vai trò người nghe.
- Mỗi tài khoản chỉ đăng ký một lần cho mỗi đêm.

**Cách sử dụng:**

1. Đăng nhập tài khoản Nerd Society.
2. Mở đêm muốn tham gia.
3. Chọn **Không, mình đến nghe thôi**.
4. Nhập tên và số điện thoại.
5. Chọn từ một đến ba lĩnh vực quan tâm.
6. Nhấn **Đăng ký**.
7. Thanh toán trong vòng 30 phút để giữ chỗ.

### Đăng ký làm speaker

**Công dụng:**

- Đăng ký chia sẻ một chủ đề trong khoảng 5–10 phút.
- Chủ đề cần được staff duyệt trước khi xuất hiện công khai.

**Cách sử dụng:**

1. Trong form đăng ký, chọn **Có, mình muốn chia sẻ**.
2. Nhập chủ đề chính.
3. Có thể nhập thêm hai chủ đề dự phòng.
4. Nhập mô tả ngắn.
5. Chọn có hoặc không sử dụng slide.
6. Chọn lĩnh vực quan tâm.
7. Nhấn **Đăng ký**.
8. Thanh toán vé.
9. Chờ staff duyệt chủ đề.

**Trạng thái speaker:**

- `PENDING`: Đang chờ duyệt.
- `APPROVED`: Đã được duyệt.
- `REJECTED`: Bị từ chối.

### Thanh toán vé

**Công dụng:**

- Thanh toán bằng chuyển khoản VietQR.
- Hệ thống tự động đối soát và xác nhận vé.

**Cách sử dụng:**

1. Sau khi đăng ký, quét mã VietQR.
2. Chuyển đúng số tiền.
3. Giữ nguyên nội dung chuyển khoản.
4. Chờ hệ thống tự xác nhận.
5. Nếu đã chuyển nhưng chưa cập nhật, nhấn **Đã chuyển nhưng vé chưa cập nhật**.

**Trạng thái thanh toán:**

- `UNPAID`: Chưa thanh toán.
- `PENDING`: Đang chờ kiểm tra.
- `CONFIRMED`: Vé đã được xác nhận.

### Huỷ đăng ký

**Công dụng:** Trả lại chỗ nếu khách không thể tham dự.

**Cách sử dụng:**

1. Mở `/profile/nerd-night`.
2. Chọn vé muốn huỷ.
3. Nhấn **Huỷ đăng ký**.
4. Xác nhận huỷ.

**Điều kiện:**

- Chỉ tự huỷ khi vé chưa được xác nhận.
- Nếu đã chuyển tiền, Nerd Society sẽ xử lý hoàn tiền.
- Nếu vé đã xác nhận, khách cần liên hệ trực tiếp Nerd Society.

### Bình chọn speaker

**Công dụng:** Bình chọn phần chia sẻ yêu thích nhất.

**Cách sử dụng:**

1. Chờ staff mở bình chọn.
2. Mở trang chi tiết đêm Nerd Night.
3. Chọn tab **Vote**.
4. Chọn một speaker.
5. Xác nhận bình chọn.

**Điều kiện:**

- Phải có vé đã xác nhận.
- Mỗi người chỉ được vote một lần trong một đêm.

### Gửi feedback

**Công dụng:**

- Đánh giá chất lượng Nerd Night sau khi kết thúc.
- Feedback có thể được hiển thị công khai.

**Cách sử dụng:**

1. Mở sự kiện đã kết thúc.
2. Chọn tab **Feedback**.
3. Chọn từ một đến năm điểm.
4. Nhập nhận xét.
5. Nhấn **Gửi feedback**.

Người dùng có thể quay lại chỉnh sửa feedback đã gửi.

### Quản lý Nerd Night cá nhân

Truy cập `/profile/nerd-night` để:

- Xem tất cả đêm đã đăng ký.
- Theo dõi trạng thái vé.
- Theo dõi thanh toán.
- Huỷ đăng ký.
- Mở lại trang sự kiện.
- Gửi feedback cho sự kiện đã kết thúc.

## 1.2. Chức năng dành cho admin/staff

### Quản lý sự kiện

**Cách sử dụng:**

1. Truy cập `/admin/nerd-night`.
2. Nhấn tạo sự kiện mới hoặc chọn sự kiện có sẵn.
3. Nhập season, số thứ tự đêm, chủ đề, tiêu đề, ngày giờ và địa điểm.
4. Nhập giá vé, tổng sức chứa và số suất speaker.
5. Nhập ghi chú nếu cần.
6. Chọn có mở đăng ký người nghe và speaker hay không.
7. Lưu sự kiện.

**Trạng thái sự kiện:**

- `DRAFT`: Bản nháp.
- `PUBLISHED`: Đã công khai.
- `COMPLETED`: Đã kết thúc.
- `CANCELLED`: Đã huỷ.

### Quản lý người tham dự

Admin có thể:

- Xem tên, điện thoại và email.
- Xem mã đăng ký.
- Xem vai trò người nghe hoặc speaker.
- Xem chủ đề và lĩnh vực quan tâm.
- Xem trạng thái thanh toán.
- Xoá slot chưa phát sinh giao dịch.

### Duyệt speaker

**Cách sử dụng:**

1. Mở chi tiết sự kiện.
2. Chọn tab **Speaker**.
3. Xem chủ đề chính, chủ đề dự phòng, mô tả và thông tin slide.
4. Nhấn **Duyệt speaker** hoặc **Từ chối**.

### Quản lý thanh toán

Admin có thể:

- Xác nhận giao dịch đang chờ.
- Bỏ xác nhận nếu thao tác nhầm.
- Nhập lý do bỏ xác nhận.
- Theo dõi giao dịch VietQR tự động.
- Đánh dấu đã hoàn tiền.

### Quản lý bình chọn

Admin có thể:

- Đóng bình chọn.
- Mở bình chọn.
- Công bố kết quả.
- Xem số vote của từng speaker.
- Reset toàn bộ lượt vote.

### Quản lý feedback

Admin có thể:

- Xem số lượng feedback.
- Xem điểm đánh giá.
- Đọc nhận xét của khách.
- Theo dõi chất lượng từng đêm.

---

# 2. Monthly Beaver

## 2.1. Chức năng dành cho khách hàng

### Xem thông tin gói

**Công dụng:**

- Xem giá và quyền lợi Monthly Beaver.
- So sánh với việc mua combo lẻ.
- Xem hướng dẫn sử dụng và câu hỏi thường gặp.

**Gói hiện tại:**

- Giá: **549.000đ/30 ngày**.
- Sử dụng tối đa tám giờ/ngày.
- Dùng tại cả hai cơ sở.
- Bắt đầu tính từ lần tap thẻ đầu tiên.

**Quyền lợi:**

- Check-in nhanh bằng thẻ.
- Sử dụng không gian làm việc.
- Locker theo chính sách của cơ sở.
- Bốn voucher đồ uống mỗi tháng.
- Các ưu đãi dành cho hội viên.

### Đăng ký Monthly Beaver

**Cách sử dụng:**

1. Truy cập `/monthly-beaver`.
2. Nhấn **Đăng ký ngay**.
3. Đăng nhập hoặc tạo tài khoản Nerd Society.
4. Chọn gói Monthly Beaver.
5. Nhập họ tên, số điện thoại và email.
6. Chọn cơ sở chính.
7. Chụp ảnh selfie.
8. Nhấn **Tiếp tục**.
9. Chọn phương thức thanh toán.
10. Hoàn tất thanh toán.

### Chụp selfie xác thực

**Công dụng:**

- Xác minh người sử dụng thẻ.
- Hạn chế cho mượn hoặc dùng chung thẻ.

**Cách sử dụng:**

1. Cho phép trình duyệt truy cập camera.
2. Đưa khuôn mặt vào khung hình.
3. Chụp ảnh.
4. Kiểm tra ảnh.
5. Nếu chưa phù hợp, chọn **Chụp lại**.

### Thanh toán bằng VietQR

**Cách sử dụng:**

1. Chọn **Chuyển khoản ngay**.
2. Quét mã VietQR.
3. Chuyển đúng số tiền.
4. Giữ nguyên mã đơn trong nội dung chuyển khoản.
5. Giữ trang thanh toán đang mở.
6. Hệ thống tự chuyển sang trang thành công sau khi nhận tiền.

### Thanh toán bằng Ví Nerd

**Cách sử dụng:**

1. Chọn **Ví Nerd**.
2. Kiểm tra số dư.
3. Nhấn **Thanh toán bằng Ví Nerd**.
4. Tiền được trừ trực tiếp từ ví.
5. Đơn chuyển sang trạng thái đã thanh toán.

Nếu số dư không đủ, khách cần nạp thêm tiền hoặc sử dụng VietQR.

### Nhận và kích hoạt thẻ

**Cách sử dụng:**

1. Sau khi thanh toán, đến cơ sở đã đăng ký.
2. Cung cấp mã đơn cho nhân viên.
3. Nhân viên kiểm tra thanh toán.
4. Nhân viên gán thẻ Monthly Beaver.
5. Tap thẻ lần đầu để kích hoạt gói.
6. Gói bắt đầu có hiệu lực trong 30 ngày.

### Check-in và check-out

**Cách sử dụng:**

- Khi đến: tap thẻ để check-in.
- Khi về: tap lại thẻ để check-out.
- Không cần thanh toán riêng từng lần sử dụng.

Hệ thống sẽ:

- Ghi nhận cơ sở.
- Ghi nhận giờ vào và giờ ra.
- Tính tổng thời gian sử dụng.
- Kiểm tra giới hạn tám giờ/ngày.
- Ghi nhận phí vượt giờ nếu có.

### Phí vượt giờ

- Miễn phí trong giới hạn tám giờ/ngày.
- Phần vượt giới hạn được tính 15.000đ/giờ.
- Thời gian được làm tròn theo mỗi 15 phút.
- Phí vượt giờ trở thành công nợ.
- Khách phải thanh toán công nợ trước lần check-in tiếp theo.

### Quản lý gói cá nhân

Truy cập `/profile/monthly-beaver` để:

- Xem trạng thái đơn đăng ký.
- Xem gói đang hoạt động.
- Xem ngày kích hoạt và ngày hết hạn.
- Xem giới hạn sử dụng.
- Xem mã hội viên.
- Xem mã thẻ vật lý.
- Xem cơ sở chính.
- Xem lịch sử check-in.
- Xem thời lượng và phí của từng phiên.

### Gia hạn gói

**Cách sử dụng:**

1. Mở `/profile/monthly-beaver`.
2. Nhấn **Gia hạn gói**.
3. Chọn gói.
4. Chọn VietQR hoặc Ví Nerd.
5. Hoàn tất thanh toán.
6. Tiếp tục sử dụng thẻ hiện tại.

Gói không tự động gia hạn; khách chủ động thực hiện.

## 2.2. Chức năng dành cho staff

### Gán thẻ hội viên

**Cách sử dụng:**

1. Mở đơn đã thanh toán.
2. Nhập mã thẻ ZKTeco.
3. Nhập tên nhân viên thực hiện.
4. Nhấn gán thẻ.
5. Hệ thống tạo hồ sơ hội viên và gói chờ kích hoạt.
6. Thẻ được đồng bộ với MyTime.

### Theo dõi khách đang sử dụng

Staff có thể:

- Xem khách đang check-in.
- Xem thời gian bắt đầu.
- Xem cơ sở.
- Xem thời lượng đang sử dụng.
- Check-out thủ công khi cần.

### Check-in thủ công

**Cách sử dụng:**

1. Mở staff dashboard.
2. Chọn cơ sở.
3. Nhập số điện thoại khách.
4. Nhấn check-in.
5. Hệ thống kiểm tra gói, công nợ và giới hạn sử dụng.

### Xử lý cảnh báo

Staff nhận cảnh báo khi:

- Khách có công nợ.
- Gói đã hết hạn.
- Khách gần hoặc đã đạt giới hạn tám giờ.
- Phiên check-in kéo dài bất thường.
- Thẻ hoặc hội viên không hợp lệ.

## 2.3. Chức năng dành cho admin

### Quản lý đơn đăng ký

Admin có thể:

- Xem và lọc đơn theo trạng thái hoặc cơ sở.
- Xác nhận thanh toán.
- Gán thẻ.
- Huỷ đơn.
- Ghi nhận lý do huỷ.
- Hoàn tiền về Ví Nerd khi phù hợp.

### Quản lý hội viên

Admin có thể:

- Tìm theo tên hoặc số điện thoại.
- Xem thông tin hội viên.
- Xem gói hiện tại.
- Xem công nợ.
- Xem lịch sử sử dụng.
- Đổi thẻ mới khi mất thẻ.
- Khoá hoặc xoá hội viên.

### Quản lý phiên trực tuyến

Admin có thể:

- Xem tất cả khách đang ngồi.
- Lọc theo cơ sở.
- Xem giờ check-in.
- Check-out thủ công.
- Theo dõi thời lượng và phí phát sinh.

### Báo cáo

Admin có thể xem theo tháng:

- Số đơn đăng ký.
- Số hội viên.
- Doanh thu.
- Số phiên sử dụng.
- Tổng thời gian sử dụng.
- Tình trạng gói và công nợ.

### Cài đặt đăng ký

Trong phần cài đặt hệ thống, admin có thể:

- Mở nhận đăng ký Monthly Beaver mới.
- Tạm ngừng nhận đăng ký.
- Bật hoặc tắt email thông báo đơn mới.
- Bật hoặc tắt email xác nhận thanh toán.
