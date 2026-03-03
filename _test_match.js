const combined = '가로 2미터 세로 2.4미터 가벽 허니콤보드 가벽은 가볍지만 튼튼하고';
const products = [
  {code:'hb_dw_1', name:'허니콤 가벽', is_custom_size:true},
  {code:'hb_dw_31', name:'병풍형 가벽', is_custom_size:true},
  {code:'hb_bn_2', name:'허니콤 연결형 배너', is_custom_size:true},
];
const matched = products.filter(p => {
  if (!p.is_custom_size) return false;
  const name = (p.name || '').toLowerCase();
  const keywords = name.split(/\s+/).filter(w => w.length >= 2);
  console.log('  name:', p.name, 'keywords:', keywords, 'check:', keywords.map(kw => combined.toLowerCase().includes(kw)));
  return keywords.some(kw => combined.toLowerCase().includes(kw));
});
console.log('matched:', matched.map(p=>p.code));

// Also test regex
const trimmedMsg = '가로 2미터 세로 2.4미터 가벽';
const hasUserSize = /\d+\s*(mm|cm|미터|센치|밀리)|\d+\s*m\s|\d+\s*(×|x)\s*\d+/i.test(trimmedMsg);
console.log('hasUserSize:', hasUserSize);
