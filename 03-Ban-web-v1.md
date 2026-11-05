# BẢN WEB V1: "ĐÓN TREND" — PHẠM VI, ĐIỀU CHỈNH SO VỚI KẾ HOẠCH VÀ CÁCH CHẠY

> Thuộc nền tảng **Việt Nam Online**. Tài liệu này ghi lại bản web đầu tiên đã được code (thư mục `web/`), những chỗ **đã điều chỉnh so với tài liệu 00, 01, 02** và lý do, cùng các bước tiếp theo.

| Thông tin | Chi tiết |
|---|---|
| Phiên bản | v0.1 (bản web thử nghiệm) |
| Ngày | 04/11/2026 |
| Trạng thái | Chạy được, đã kiểm thử trên Chrome desktop và giả lập điện thoại |
| Mã nguồn | `web/` |

---

## 1. Vì sao có bản này

Trend "đi chùa online" bắt đầu cuối tháng 10/2026. Theo lộ trình trong tài liệu 01, beta kín vào tháng 1/2027 và ra mắt công khai khoảng tháng 3/2027, lúc đó trend đã nguội. Bản v1 vì vậy cắt phạm vi xuống **một khu duy nhất có khoảnh khắc lan truyền mạnh nhất** (Sông Hàn và Cầu Rồng phun lửa), chạy ngay trên trình duyệt, vào bằng link, không cần cài đặt.

Bản này vẫn tuân thủ **quy tắc vàng** (tài liệu 00, mục 2.3): code Engine và Kit không chứa tên "Đà Nẵng", "Cầu Rồng" hay "Mỹ Khê". Toàn bộ nội dung nằm trong `web/public/destinations/danang/`.

## 2. Đã có trong bản v1

| Tính năng | Mô tả | Theo tài liệu |
|---|---|---|
| Bản đồ Việt Nam là màn hình chính | Có đủ hai quần đảo Hoàng Sa và Trường Sa. Ghim điểm đến hiển thị giờ thật, thời tiết thật, số người online. Điểm đến chưa mở có nút "Tôi muốn đi" để đo nhu cầu. | 00 – 4.1, 14 |
| Thẻ lên máy bay | Nhập tên, chọn màu áo, đội nón lá; "xé cuống vé" để bay tới điểm đến. | 00 – 4.2 (rút gọn) |
| Khu Z01 Sông Hàn & Cầu Rồng | Sông, bờ kè, lối dạo có đèn, dừa, ghế đá. Cầu Rồng có thân uốn lượn và LED đổi màu ban đêm. Có Cầu Tình Yêu, tượng cá chép hóa rồng phun nước, Cầu Sông Hàn và Cầu Trần Thị Lý ở xa, xe chạy trên đường, thành phố sáng đèn, núi Sơn Trà và Bà Nà làm phông nền. | 01 – Z01 |
| Đồng hồ thế giới | Mặt trời, mặt trăng (đúng pha), sao tính theo tọa độ và giờ thật của Đà Nẵng. Thời tiết thật từ Open-Meteo, cập nhật 10–15 phút một lần: mưa, mây, sương ảnh hưởng tới cảnh. | 01 – 8 |
| Cầu Rồng phun lửa, phun nước | Chạy theo lịch thật (21h tối thứ Bảy, Chủ nhật). Mọi người trong phòng thấy cùng lúc vì tính theo giờ server. Có đếm ngược, ánh lửa hắt xuống sông, tiếng lửa, hơi nước bắn vào màn hình khi đứng gần. NPC kéo về xem. | 01 – Z01, 00 – kit `scheduled-spectacle` |
| Xem lại sự kiện | Xem riêng cho mình, không nhận dấu hiếm. | 01 – 8 |
| Giờ tự chọn | Vào phòng riêng với giờ bất kỳ, không gặp người khác, không nhận dấu hiếm. | 01 – 8 |
| Multiplayer | Thấy người khác đi lại, chat (có lọc từ), bong bóng chat trên đầu, 5 biểu cảm. Matchmaker xếp phòng "đông vừa đủ" (40/80 người) và giữ nhóm bạn ở cùng phòng. | 02 – 3, 4 |
| Chặn người khác | Bấm vào tên trong khung chat để chặn: ẩn nhân vật, tin nhắn và biểu cảm của người đó. | 02 – 9.1 (tối thiểu) |
| NPC du khách | Bổ sung cho đủ 14 người trong khu. NPC không có bảng tên để không bị nhầm là người thật. | 01 – 2 (nguyên tắc 4) |
| Ổ khóa Cầu Tình Yêu | Treo khóa kèm lời nhắn và người nhận. Lưu trên server, đồng bộ tức thì cho mọi người. Đứng gần là đọc được lời nhắn, có thể thả tim. Giới hạn 5 khóa mỗi giờ mỗi IP, có lọc từ. | 01 – Z01, 7.3 |
| Di chuyển trong khu | Nút **Đi đâu** (phím M) liệt kê các địa điểm kèm khoảng cách. **Chỉ đường**: tìm đường trên vùng đi được (biết vòng qua dốc cầu), hiện chấm vàng trên mặt đất, cột sáng ở đích, mũi tên và số mét còn lại. **Tự đi**: nhân vật tự đi theo đường, chạm cần gạt hoặc phím để dừng. **Đi nhanh**: dịch chuyển tới nơi đã có dấu. Bấm vào tem trong hộ chiếu cũng chỉ đường hoặc đi nhanh được. | 01 – 4.3e |
| Khu Z02 Biển Mỹ Khê | Bãi cát dốc (cát khô, cát ướt), sóng chạy vào bờ, bọt sóng, ô dù, ghế nằm, chòi cứu hộ, thúng chai, đường Võ Nguyên Giáp có xe chạy, khách sạn, Sơn Trà phía bắc. Mặt trời mọc từ biển đúng giờ thật; dấu hiếm "Người đón bình minh". | 01 – Z02 |
| Taxi giữa các khu | Điểm đón taxi ở mỗi khu. Quãng đường tính từ tọa độ thật (đường chim bay × 1,35): Cầu Rồng → Mỹ Khê 2,9 km, → Bà Nà 36 km. Khu chưa mở hiện "Sắp mở". Trên xe: ngồi ghế sau nhìn qua kính, có tài xế, đồng hồ km, phố lùi lại, gần tới biển thì thấy biển; khu đích được dựng ngầm trong lúc đi (18–45 giây, có nút "Tới nhanh"). Rủ người đứng gần đi cùng: họ nhận lời mời, đồng ý thì tới nơi cùng phòng. | 01 – 4.3d; 02 – 13.3 |
| Xe máy, chở nhau | Bãi thuê xe ở mỗi khu. Bấm E khi đang chạy: **dựng xe tại chỗ**, người bước xuống bên cạnh (đang ở lòng đường thì bước lên vỉa hè gần nhất); lại gần bấm E để lên lại; mang xe về bãi để trả. Người khác thấy xe đang dựng; tải lại trang xe vẫn ở chỗ cũ; đi taxi sang khu khác thì xe được trả. B (hoặc nút "Bíp") để bóp còi, người xung quanh nghe được. Lái bằng W A S D (Shift để nhanh hơn), tối đa khoảng 50–60 km/h, chạy trên vỉa hè, lòng đường, cầu. Người khác đứng cạnh bấm "Xin đi nhờ", người lái đồng ý thì ngồi sau; mọi người trong phòng đều thấy hai người chung xe. Có tiếng máy xe. | 01 – 4.3d; 02 – 8 |
| Bản đồ | Bản đồ nhỏ góc màn hình xoay theo hướng nhìn, có chữ B chỉ hướng Bắc, địa điểm (ô đỏ, tô kín khi đã có dấu), taxi, bãi xe, xe của bạn, người chơi khác, đích chỉ đường. Bấm vào (hoặc phím M) mở bản đồ lớn hướng Bắc lên trên: chạm địa điểm hay chỗ đi bộ được để chỉ đường. | 01 – 4.3e |
| Việc nên làm | Trong bản đồ lớn: danh sách việc theo khu (ghé từng nơi, xem sự kiện giờ thật, treo khóa, chụp bưu thiếp, thuê xe, đi taxi) tự đánh dấu khi làm xong. | 01 – 7.2 |
| Hướng dẫn lần đầu | Thẻ chào mừng: đi lại, tìm đường, đi xa hơn, giữ kỷ niệm (nội dung khác nhau cho máy tính và điện thoại). | — |
| Nhân vật | Mặt có mắt (biết chớp), lông mày, miệng cười, má hồng; thân áo có vai, tay áo, bàn tay, quần, giày; 4 kiểu tóc chọn trên thẻ lên máy bay; nón lá có vành và quai. | — |
| Hộ chiếu | 14 dấu ở 2 khu (8 Sông Hàn, 6 Mỹ Khê): 5 dấu thường (đến nơi) và 3 dấu hiếm (có mặt lúc phun lửa, hoàng hôn thật, mưa thật). | 01 – 7.1 |
| Thuyết minh | Thẻ thông tin hiện ra khi tới gần 5 điểm, có nút đọc bằng giọng tiếng Việt của trình duyệt. | 01 – 2 (nguyên tắc 5) |
| Bưu thiếp | Chụp ảnh ở độ phân giải gấp đôi, ghép viền giấy, tem, dấu bưu điện ghi giờ thật, kèm dòng chữ viết tay. Tải ảnh về hoặc gửi link: người mở link xuất hiện đúng chỗ người gửi đứng và vào cùng phòng. | 01 – 6.2, 7.4; 02 – 4.2 |
| Âm thanh môi trường | Tiếng sông, tiếng phố, côn trùng ban đêm, mưa, lửa. Tất cả tạo bằng WebAudio. | 01 – 2 (nguyên tắc 1, tạm) |
| Điện thoại | Có cần gạt ảo, vuốt để xoay, chụm hai ngón để phóng to, giao diện riêng cho màn hình nhỏ. | 01 – 4.2 |
| Chất lượng tự động | Ba mức chất lượng, tự hạ mức khi FPS thấp. Bloom chỉ bật mạnh vào ban đêm. | 01 – 12 |

## 3. Những chỗ đã điều chỉnh so với kế hoạch

| # | Kế hoạch ban đầu | Bản v1 làm | Lý do | Khi nào làm theo kế hoạch |
|---|---|---|---|---|
| 1 | MVP có 4 khu (Z00–Z03) trong 8–10 tuần | Chỉ có Z01 | Kịp đón trend. Một khu làm thật tốt có giá trị hơn bốn khu làm sơ sài (01 – 16.1 cũng khuyên như vậy) | Thêm Z02 Mỹ Khê bằng cách thêm file `zones/z02.json` và dùng lại các kit |
| 2 | Gaussian Splatting quét thực địa và 3D Tiles | Dựng thủ tục (procedural) bằng Three.js | Chưa có dữ liệu quét. Google 3D Tiles cần API key và tuân thủ điều khoản. Màn hình chính và chân trang ghi rõ đây là cảnh mô phỏng | Giai đoạn 0 (quét thử Cầu Tình Yêu). Three.js r187 đã có `GaussianSplat` trong examples, sẽ thêm kit `splat-chunk` |
| 3 | Colyseus | Server WebSocket (`ws`) tự viết, khóa phòng giữ đúng định dạng `danang:z01:shard-N` | Ít phụ thuộc, đủ cho vài trăm người. Định dạng khóa và luật xếp phòng giữ nguyên để chuyển sang Colyseus không phải đổi client nhiều | Khi cần trạng thái phòng phức tạp hoặc nhiều máy chủ |
| 4 | PostgreSQL, Redis, Kafka → ClickHouse | File JSON (`web/data/`) | Chưa có người dùng thật, không cần hạ tầng phân tích | Trước beta công khai: PostgreSQL cho ổ khóa và hộ chiếu, PostHog hoặc Plausible cho analytics |
| 5 | Đăng nhập Google, Facebook | Hồ sơ khách lưu trên trình duyệt (tên, áo, nón, hộ chiếu) | Bớt ma sát khi vào bằng link; đúng tinh thần "vào là chơi" | Khi có hộ chiếu đa thiết bị hoặc giao dịch |
| 6 | Voice chat | Chưa có. Có chat chữ, biểu cảm, chặn | Tài liệu 02 yêu cầu checklist an toàn trước khi mở voice với người lạ | Prototype voice nhóm (LiveKit) theo 02 – 18 |
| 7 | Nút "Báo tôi khi mở" | Nút "Tôi muốn đi" kèm số người đã bình chọn | Chưa có kênh thông báo (email, push), không nên hứa điều chưa làm được. Vẫn đo nhu cầu đúng như mục tiêu ở 00 – 4.1 | Khi có tài khoản hoặc web push |
| 8 | Monorepo nhiều package (`packages/engine`, `packages/kits`…) | Một package, nhưng tách thư mục `engine/`, `kits/`, `shared/` đúng ranh giới | Nhanh hơn cho một người làm; ranh giới giữ nguyên để tách package sau | Khi có điểm đến thứ hai hoặc thêm người |
| 9 | i18n cho mọi chuỗi | Dữ liệu gói điểm đến có cả `vi` và `en`; giao diện mới có tiếng Việt | Người dùng đầu tiên là người Việt | Trước khi quảng bá cho khách quốc tế |
| 10 | Âm thanh thu tại chỗ | Âm thanh tạo bằng WebAudio | Chưa đi thực địa | Cùng đợt quét Giai đoạn 0 |
| 11 | Sổ lưu bút, ổ khóa có kiểm duyệt | Lọc từ tự động và giới hạn tần suất | Chưa có CMS | Admin CMS tối thiểu (01 – 15.2) |

**Lưu ý kỹ thuật đã gặp:** thư viện `suncalc` bản 2.x trả về **độ** và azimuth tính **từ hướng Bắc**, khác bản 1.x (radian, tính từ hướng Nam). Code đã viết theo bản 2.x.

## 4. Cấu trúc mã nguồn

```
web/
├── public/destinations/             # GÓI ĐIỂM ĐẾN (chỉ dữ liệu)
│   ├── registry.json                # danh sách điểm đến, trạng thái open/soon
│   └── danang/
│       ├── manifest.json
│       └── zones/z01.json           # vùng đi được, kit + tham số, sự kiện, dấu, thuyết minh
├── src/
│   ├── shared/                      # dùng chung client và server
│   │   ├── pack.ts                  # kiểu dữ liệu gói điểm đến
│   │   ├── schedule.ts              # lịch sự kiện theo giờ địa phương
│   │   ├── protocol.ts              # giao thức WebSocket
│   │   └── filter.ts                # lọc từ ngữ
│   ├── server/                      # Node: API + game server + phục vụ file tĩnh
│   │   ├── index.ts                 # /api/destinations, /api/locks, /api/waitlist, /api/weather, /ws
│   │   ├── rooms.ts                 # phòng theo khu, matchmaker, giữ nhóm cùng phòng
│   │   ├── weather.ts               # Open-Meteo, cache 15 phút
│   │   └── store.ts                 # lưu JSON
│   └── client/
│       ├── engine/                  # LÕI: renderer, bầu trời, nhân vật, điều khiển, mạng, âm thanh, NPC, mưa
│       ├── kits/                    # KIT: river, banks, serpent-bridge, lock-pier, statue-fountain,
│       │                            #      promenade, cityscape, beam-bridge, skyline-mountains, reflections
│       ├── world/WorldApp.ts        # ghép engine + kit + gói điểm đến
│       ├── home/Home.ts             # bản đồ Việt Nam
│       └── ui/                      # thẻ lên máy bay, bưu thiếp, icon, tem
└── scripts/gen-vn-map.ts            # sinh đường viền bản đồ từ Natural Earth
```

**Thêm một khu hoặc điểm đến mới** chỉ cần dữ liệu: thêm file JSON, khai báo các kit đã có cùng tham số mới, rồi thêm điểm đến vào `registry.json`. Chỉ khi điểm đến cần một **loại trải nghiệm mới** (ví dụ ruộng bậc thang ở Sa Pa) mới phải viết kit mới.

## 5. Hệ thống thiết kế

| Thành phần | Lựa chọn |
|---|---|
| Ý tưởng | Tem bưu chính, thẻ lên máy bay, sông Hàn về đêm. Điểm đến hiển thị như con tem, hộ chiếu đóng dấu thật, lời nhắn của người chơi viết bằng chữ viết tay |
| Màu | Mực đêm `#12213D`, giấy tem `#E8EEE4`, đỏ tem `#C8102E`, vàng đèn LED `#F2B705`, ngọc biển `#1FA39A`, sương `#A9B8CF` |
| Chữ | Be Vietnam Pro (giao diện, tiêu đề đậm 800), Patrick Hand (những gì người dùng tự viết: lời nhắn ổ khóa, bưu thiếp, bong bóng chat) |
| Nguyên tắc | Giao diện chìm trong cảnh 3D (kính mờ màu đêm); những vật "cầm được" như thẻ thuyết minh, lời nhắn, hộ chiếu thì làm bằng giấy |

## 6. Cách chạy

```bash
cd web
npm install
npm run dev          # http://localhost:5173 (giao diện) + http://localhost:8787 (API, WebSocket)
```

Bản production (một tiến trình phục vụ tất cả):

```bash
npm run build
PORT=8787 npm start  # http://localhost:8787
```

Mẹo kiểm thử: mở `http://localhost:5173/d/danang?gio=21:00` để vào phòng riêng lúc 21h, sau đó bấm "Xem lại" để xem rồng phun lửa bất kỳ lúc nào. Mở hai trình duyệt để thử multiplayer.

Khi triển khai thật, đặt sau reverse proxy có HTTPS (cần cho WebSocket `wss` và chia sẻ ảnh trên điện thoại). Thư mục `data/` cần được giữ lại giữa các lần deploy.

## 7. Việc tiếp theo (theo thứ tự ưu tiên)

1. **Deploy** lên một VPS có HTTPS; gắn PostHog hoặc Plausible để đo D1, D7, thời lượng phiên, lượt chia sẻ bưu thiếp, số người vào lúc 21h thứ Bảy.
2. **Quét thử Cầu Tình Yêu** (Giai đoạn 0 của tài liệu 01), thêm kit `splat-chunk` đặt chồng lên cảnh thủ tục.
3. **Thu âm thực địa** sông Hàn tối cuối tuần, thay âm thanh tổng hợp.
4. **Báo cáo vi phạm và CMS tối thiểu**: xóa ổ khóa, xem báo cáo, sửa lịch sự kiện. Cần làm trước khi quảng bá rộng.
5. **Z02 Mỹ Khê**: kit `ocean` và `beach`, kèm bình minh làm dấu hiếm.
6. **Voice nhóm bạn** theo tài liệu 02 (chỉ nhóm đã mời nhau, chưa mở cho người lạ).
7. Chuyển lưu trữ sang PostgreSQL và thêm đăng nhập khi có nhu cầu đồng bộ hộ chiếu.

## 7b. Bổ sung ngày 05/11/2026

- Thêm khu Z02, taxi, xe máy, chở nhau, nhân vật mới (xem bảng mục 2).
- Kit mới: `ocean`, `beach`, `beach-props`, `road` (tách từ `banks`), `transport`. Cảnh taxi ở `world/RideScene.ts`.
- Dữ liệu khu có thêm `ride` (vùng chỉ xe đi), `transport` (điểm taxi, bãi xe); manifest có tọa độ và loại cảnh (`scenery`) của từng khu.
- Giao thức mạng: trạng thái có thêm phương tiện (`v`) và người cùng xe (`w`); tin nhắn `ride` cho lời xin đi nhờ và lời rủ đi taxi.

## 7c. Hình ảnh chân thực hơn (05/11/2026)

- **Vật liệu ảnh thật** (Poly Haven, CC0, ~2,7 MB WebP trong `public/textures/`): đá granite lát vỉa hè, nhựa đường, cát, cỏ, kè đá, bê tông cầu, vỏ thân dừa. Engine `engine/Materials.ts` → `pbr(tên, cỡ_mét)` trải ảnh theo toạ độ thế giới (không cần UV), có loang màu thang lớn để không lộ mảng lặp, độ nhám tối thiểu để mặt đá không bóng như gương.
- **Ánh sáng & trời**: nắng trực tiếp mạnh hơn ánh trời (bóng đổ rõ), lớp mây theo % mây thật từ dự báo, chạng vạng sáng hơn, bỏ bloom ban ngày (từng gây màn sương trắng), khử răng cưa MSAA, chỉnh màu cuối (tương phản, bão hoà, tối góc).
- **Thành phố**: 4 kiểu mặt tiền (tháp kính phản chiếu trời, văn phòng dải cửa ngang, chung cư ban công + cục nóng, nhà ống sơn màu + biển hiệu tầng trệt); chiều cao theo bội số tầng 3 m; mái có bồn nước, tum thang; đêm sáng từng ô cửa.
- **Cây cối** (`kits/flora.ts`): dừa có tàu lá chét + thân vỏ thật + trái; cây bóng mát tán lá; khóm hoa giấy. Bờ sông Hàn có thảm cỏ, bó vỉa (`banks.lawns`), hàng cây (`promenade` kiểu `tree`).
- **Đường phố**: vạch tim vàng đôi, vạch làn, vằn qua đường (`road.crossings`), bó vỉa; ô tô dáng sedan/SUV có kính, bánh xe; **dòng xe máy có người lái** chạy sát lề như phố Việt Nam.
- **Đêm**: quầng sáng đèn đường hắt xuống mặt đất (`promenade` → `poolDx`).
- **Núi xa**: địa hình nhiễu sống núi, rừng xanh sẫm, sườn dốc lộ đá, sương khí quyển làm nhạt dần.
- **Cảnh taxi**: cùng mặt tiền, cây, ô tô với khu; xe chạy đúng làn phải.
- Nhân vật vẫn giữ phong cách hoạt hình có chủ đích (thân thiện, nhẹ máy); muốn người giống thật cần mô hình 3D dựng sẵn (glTF) — để giai đoạn sau.

## 8. Giới hạn đã biết

- Cảnh dựng mô phỏng, tỷ lệ không đúng thực tế (sông hẹp hơn thật để vừa khung hình).
- Lịch phun lửa lấy theo lịch công bố (21h thứ Bảy, Chủ nhật). **Chưa tính ngày lễ**, cần xác minh định kỳ với đơn vị vận hành.
- Chưa có báo cáo vi phạm gửi về server; chặn chỉ có hiệu lực trong phiên trình duyệt.
- Hộ chiếu lưu trên trình duyệt, xóa dữ liệu trình duyệt là mất.
- Xe máy chưa có va chạm với ô tô và người đi bộ; người ngồi sau thấy xe trễ khoảng 0,1–0,2 giây so với người lái.
- Chưa kiểm thử trên iPhone thật và máy Android tầm trung thật (mới kiểm thử bằng giả lập).

## 7d. Mở rộng bản đồ theo khoảng cách thật (05/11/2026)

- **Z01 Sông Hàn**: đường dạo hai bờ từ Cầu Sông Hàn (z = -650, cách Cầu Rồng ~650 m về phía bắc) tới Cầu Trần Thị Lý (z = +1050, ~1,1 km về phía nam), dài ~1,9 km mỗi bờ. Đường Bạch Đằng / Trần Hưng Đạo cho xe máy dài ~2,5 km. Thêm 2 điểm ghé có tem: "Cầu Sông Hàn", "Cầu Trần Thị Lý" (biểu tượng tem `bridge`).
- **Z02 Mỹ Khê**: bãi biển, đường dạo và đường Võ Nguyên Giáp dài ~2,8 km (z ±1400).
- Thảm cỏ, hàng dừa, cây bóng mát, đèn, ghế, dù bãi biển và nhà phố được nối dài theo; số ô tô/xe máy tăng tương ứng.
- **Hiệu năng**: `engine/Culler.ts` (InstanceCuller) chỉ vẽ các bản sao InstancedMesh tĩnh trong bán kính quanh camera (300–900 m tuỳ cỡ vật); xe trên đường chỉ vẽ trong 520 m; nhà phố chia khối 400 m để bỏ qua đoạn ngoài khung nhìn và ẩn chi tiết mái ở xa. Kết quả: ~840k tam giác/khung (Z01) — trước khi cắt là 1,6 triệu; số draw call giữ ~770.
