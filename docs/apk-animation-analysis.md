# APK 动画分析

参考文件：用户提供的 `小决定.apk.1`。分析、资源提取和构建均通过 conda JK 环境运行；未执行 APK 内的代码。

## 随机数字

从 `lib/arm64-v8a/libapp.so` 识别出 Dart SDK 3.8.1。使用 unflutter 的公开分支静态解析快照和 ARM64 指令，得到 29,014 个函数；没有恢复完整 Dart 源码。工具来源：https://github.com/turingH/unflutter-iOS

核心方法和虚拟地址：

- `_NumberPageState._startTimer`：`0x811350`，读取动画时长，调用 `CurvedTimer`。
- `CurvedTimer` 的计时回调：`0x811574`，每次累计 100 毫秒。
- `0x8116f8` 至 `0x811710`：浮点指令计算下一次刷新阈值 `t + (t / T)² × T`，等价于 `t + t² / T`。
- 数字页回调 `0x80faa0`：播放声音、调用 `_generate`，结束时更新状态并写入历史。
- `_generate`：`0x8109b8`；随机数生成闭包 `0x810a60` 调用随机数、重复检查和排序逻辑。
- `_buildSingleResultView`：`0x848354`，单个大数字、居中。
- `_buildGridResultView`：`0x848170`，使用 `RandomNumberCell` 和 `GridView.builder`。

因此过程为“数字内容快速刷新，间隔逐渐增长，最终停下”，而不是旋转随机图标，也不是各位数字竖向滚轮。桌面实现保留计时公式和两种结果布局，并让中间数字同样遵守范围、数量、去重、排序规则。

复查入口：`scripts/inspect-apk.py`、`scripts/trace-number.py`；解包和静态分析输出在 `.reference/`，不进入安装包。反汇编中的对象池符号部分不可靠，因此上述结论依据 ARM64 运算和已恢复的方法调用，不依据孤立的对象池注释。

## 硬币和声音

使用 APK 自带的六种硬币正反面图片及四种正反面转换视频（浅色版本）。根据当前面和随机目标面选择对应视频，播放结束后公布并记录结果。

声音使用 `tick.wav`、`pop.wav`、`win.wav`；转盘指针跨过扇区时播放 tick，最终结果播放 win。素材存放于 `public/reference/`，可离线运行。

## 转盘连续点击（0.2.1）

- 指针回调 `_WheelState` 的 `sub_3190ec`（VA `0x83f96c`）检查是否有启用选项，但没有以“正在转动”直接拒绝点击。
- `0x83fa9c` 调用 `AnimationController.reset`（`0x83fb6c`），然后 `setState` 进入新一轮抽取闭包。
- `sub_319758`（`0x83ffd8`）调用 `Decision.draw`（`0x8406e8`），设置新的 Tween 终点，最后调用控制器开始正向播放。
- `0x840118` 至 `0x840130` 的运算为 `5 * (floor(seconds / 5) + 1)` 圈，加上抽取扇区的目标角度。Tween 起点由构造函数初始化，并在每次控制器 reset 后恢复。
- 扇区点击 `_onTapWheel` 有独立的运行状态限制，与中央指针回调不是同一行为。

桌面版据此重置并重启每次指针点击的动画，取消前一轮结束回调，只为最终完成的一次写入历史。已有桌面版扇区中心落点与减速曲线继续保留。
