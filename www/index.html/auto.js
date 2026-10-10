import { registerPlugin, Capacitor } from '@capacitor/core';

// 1. 注册 Java 插件（名字必须和 Java 里的 @CapacitorPlugin(name = "BillListener") 一模一样）
const BillListener = registerPlugin('BillListener', {
  // 如果在电脑浏览器打开，这个方法什么都不做，防止报错
  web: () => ({}) 
});

// 2. 引导用户去安卓系统设置里开启“通知使用权”
window.enableAutoBill = async function () {
  if (Capacitor.getPlatform() !== 'android') {
    alert('自动记账功能需要在安卓手机上运行哦！');
    return;
  }
  try {
    // 跳转到安卓的通知使用权设置页
    await Capacitor.openUri({ url: 'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS' });
  } catch (err) {
    alert('请手动去手机设置 -> 应用 -> 特殊应用权限 -> 通知使用权，找到“AutoBill”并开启');
  }
};

// 3. 启动后台监听服务
window.startAutoBillService = async function () {
  try {
    await BillListener.start();
    console.log('✅ 自动记账后台服务已启动');
    alert('自动记账已开启！现在去用微信或支付宝付一笔钱试试吧！');
  } catch (err) {
    console.error('启动失败', err);
    alert('启动失败，请确保已开启通知使用权');
  }
};

// 4. 监听来自 Java 层的账单数据（核心对接！）
BillListener.addListener('bill', (data) => {
  console.log('🎯 抓到一笔自动账单:', data);
  
  // 防重复：如果3秒内有同样金额的单子，直接忽略（防止通知更新导致重复记账）
  const now = Date.now();
  if (window._lastBillTime && (now - window._lastBillTime < 3000) && Math.abs(window._lastBillAmount - data.amount) < 0.01) {
    return;
  }
  window._lastBillTime = now;
  window._lastBillAmount = data.amount;

  // 调用保存逻辑
  saveAutoBill(data.amount, data.pkg, data.text);
});

// 5. 保存数据到你的记账本
function saveAutoBill(amount, pkg, text) {
  // 读取你原来的数据
  let records = JSON.parse(localStorage.getItem('accountRecords') || '[]');
  
  // 智能判断分类
  let type = '其他';
  if (/餐|饭|面|饺|咖啡|美团|饿了么/.test(text)) type = '餐饮';
  else if (/地铁|公交|打车|滴滴|加油/.test(text)) type = '交通';
  else if (/超市|便利店|淘宝|京东|拼多多/.test(text)) type = '购物';

  // 判断是支出还是收入（微信通知里通常有“支出”或“收入”字样）
  let isIncome = text.includes('收入') || text.includes('充值') || text.includes('收款');

  // 新增一条记录
  records.push({
    id: Date.now(),
    amount: amount,
    type: type,
    date: new Date().toLocaleDateString(),
    remark: (pkg === 'com.tencent.mm' ? '微信' : '支付宝') + '自动 | ' + text.substring(0, 15),
    isIncome: isIncome
  });

  // 保存回本地存储
  localStorage.setItem('accountRecords', JSON.stringify(records));

  // 弹窗提示用户
  showToast(`🤖 自动记账成功：${isIncome ? '收入' : '支出'} ¥${amount}`);

  // 如果你页面有刷新列表的函数（比如叫 renderList），可以在这里调用一下
  if (typeof renderList === 'function') {
    renderList();
  }
}

// 页面底部弹出提示框
function showToast(msg) {
  let div = document.createElement('div');
  div.textContent = msg;
  Object.assign(div.style, {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '12px 24px', 
    borderRadius: '25px', fontSize: '15px', zIndex: 99999
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}// === 新增：主题色管理逻辑 ===

// 1. 初始化：页面加载时读取用户保存的颜色
document.addEventListener('DOMContentLoaded', () => {
    const savedColor = localStorage.getItem('userThemeColor');
    if (savedColor) {
        applyThemeColor(savedColor);
        document.getElementById('colorPicker').value = savedColor;
    }
});

// 2. 绑定设置按钮事件
const settingsBtn = document.getElementById('settingsBtn');
const colorPicker = document.getElementById('colorPicker');

if (settingsBtn && colorPicker) {
    settingsBtn.addEventListener('click', () => {
        colorPicker.click(); // 点击设置按钮时，触发隐藏的颜色选择器
    });

    // 3. 监听颜色变化
    colorPicker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        applyThemeColor(newColor);
        localStorage.setItem('userThemeColor', newColor); // 保存到本地
    });
}

// 4. 应用颜色的核心函数
function applyThemeColor(color) {
    const btn = document.getElementById('autoBillBtn');
    if (btn) {
        // 使用 !important 确保覆盖原有 CSS
        btn.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)}) !important`;
        btn.style.boxShadow = `0 4px 15px ${color}66 !important`; // 66 是透明度的十六进制
    }
}

// 辅助函数：让渐变色的第二层稍微深一点（可选）
function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}