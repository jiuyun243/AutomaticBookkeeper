package com.example.autobill;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void oncreate(Bundle savedInstanceState) {
    super.oncreate(savedInstanceState);
    // 注册我们自己的自动记账插件
    registerPlugin(BillListenerPlugin.class);
  }
}
