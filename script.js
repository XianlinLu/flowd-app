const fs = require('fs');
const file = 'my-app/src/components/FlowdCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/text-\[22px\]/g, 'text-[18px]');
content = content.replace(/text-\[16px\] leading-relaxed/g, 'text-[16px] leading-[24px]');
content = content.replace(/text-\[16px\] font-medium tracking-tight leading-snug/g, 'text-[16px] leading-[24px] font-medium tracking-tight');
content = content.replace(/space-y-2 text-\[16px\]/g, 'space-y-2 text-[16px] leading-[24px]');

fs.writeFileSync(file, content);

const chatFile = 'my-app/src/components/ChatPanel.tsx';
let chatContent = fs.readFileSync(chatFile, 'utf8');
chatContent = chatContent.replace(/text-\[16px\] font-medium bg-white\/60/g, 'text-[14px] font-medium bg-white/60');
fs.writeFileSync(chatFile, chatContent);
