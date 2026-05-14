import fs from 'fs';

const path = 'src/app/(admin)/admin/subscriptions/_components/SubscriberTable.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldText = '<Badge color="blue">{currentSub.dailyLimitMin / 60}h/ngày</Badge>';
const newText = `(() => {
                        const rem = currentSub.dailyLimitMin - (sub.todayUsedMin || 0);
                        if (rem <= 0) return <Badge color="red">Hết giờ hôm nay</Badge>;
                        const h = Math.floor(rem / 60);
                        const m = rem % 60;
                        return (
                          <Badge color="blue">
                            Còn {h > 0 ? \`\${h}h \` : ''}{m}p hôm nay
                          </Badge>
                        );
                      })()`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(path, content);
  console.log('✅ Updated SubscriberTable.tsx successfully!');
} else {
  console.log('❌ Could not find oldText in SubscriberTable.tsx');
  // Try a more flexible match
  const lines = content.split('\n');
  const index = lines.findIndex(l => l.includes('{currentSub.dailyLimitMin / 60}h/ngày'));
  if (index !== -1) {
    console.log('Found line at index:', index);
    lines[index] = lines[index].replace('<Badge color="blue">{currentSub.dailyLimitMin / 60}h/ngày</Badge>', newText);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('✅ Updated via flexible match!');
  }
}
