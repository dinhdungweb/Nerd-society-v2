ALTER TABLE "NerdNightEvent"
ADD COLUMN "topicPrompt" TEXT;

UPDATE "NerdNightEvent"
SET "topicPrompt" = 'Nghe hơi trừu tượng? Vài chủ đề đời thường có thể kể theo hướng này:'
WHERE "topicPrompt" IS NULL;

UPDATE "NerdNightEvent"
SET "topicSuggestions" = ARRAY[
  'Vì sao bài hát cũ luôn “đúng lúc” bật lên khi mình buồn',
  'Lý thuyết riêng về việc tại sao nhóm bạn nào cũng có một người hay trễ giờ',
  'Vì sao đồ ăn tự nấu ngon hơn hẳn dù công thức y hệt ngoài hàng',
  'Một khung giải thích cho thói quen mua sách về rồi không đọc',
  'Vì sao tin nhắn “đã xem” gây áp lực hơn cả cuộc gọi nhỡ',
  'Lý thuyết cá nhân về việc review 1 sao luôn đáng tin hơn 5 sao'
]::TEXT[]
WHERE UPPER("themeCode") = 'THEORY'
  AND "topicSuggestions" = ARRAY[
    'Game Theory',
    'Broken Windows Theory',
    'Iceberg Theory',
    'Attachment Theory',
    'Chaos Theory',
    'Big Man Theory'
  ]::TEXT[];
