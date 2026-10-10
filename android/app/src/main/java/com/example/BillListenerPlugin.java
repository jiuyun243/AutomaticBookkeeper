package com.example.autobill; // 确保这里和你的包名一致

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "BillListener")
public class BillListenerPlugin extends Plugin {

    private static WeakReference<BillListenerPlugin> instanceRef;

    @Override
    public void load() {
        instanceRef = new WeakReference<>(this);
    }

    /** JS 调用这个方法启动服务 */
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), BillService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("启动失败: " + e.getMessage());
        }
    }

    /** 真正的后台监听服务 */
    public static class BillService extends NotificationListenerService {

        // 正则表达式：匹配 "支出25.00", "¥25", "25元" 等格式
        private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?i)[支出入费]\\s*[：:]?\\s*[¥￥]?\\s*([0-9]+\\.?[0-9]*)");

        @Override
        public void onCreate() {
            super.onCreate();
            // Android 8.0+ 必须建立通知渠道才能运行前台服务
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        "bill_listener_channel", 
                        "自动记账服务", 
                        NotificationManager.IMPORTANCE_LOW);
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) manager.createNotificationChannel(channel);
                
                Notification notification = new Notification.Builder(this, "bill_listener_channel")
                        .setContentTitle("自动记账运行中")
                        .setContentText("正在监听支付通知...")
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .build();
                startForeground(1001, notification);
            }
        }

        @Override
        public void onNotificationPosted(StatusBarNotification sbn) {
            String packageName = sbn.getPackageName();
            
            // 只处理微信和支付宝的通知
            if (!packageName.equals("com.tencent.mm") && !packageName.equals("com.eg.android.AlipayGphone")) {
                return;
            }

            Notification notification = sbn.getNotification();
            if (notification == null || notification.extras == null) return;

            String title = String.valueOf(notification.extras.getCharSequence(Notification.EXTRA_TITLE));
            String text = String.valueOf(notification.extras.getCharSequence(Notification.EXTRA_TEXT));
            String content = (title == null ? "" : title) + " " + (text == null ? "" : text);

            Matcher matcher = AMOUNT_PATTERN.matcher(content);
            if (!matcher.find()) return;

            double amount;
            try {
                amount = Double.parseDouble(matcher.group(1));
            } catch (Exception e) {
                return;
            }

            // 将数据发送给 JS 层
            JSObject ret = new JSObject();
            ret.put("amount", amount);
            ret.put("pkg", packageName);
            ret.put("text", content);
            ret.put("title", title == null ? "" : title);

            BillListenerPlugin plugin = instanceRef != null ? instanceRef.get() : null;
            if (plugin != null) {
                plugin.notifyListeners("bill", ret);
            }
        }
    }
}