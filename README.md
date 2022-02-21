本项目为[Adachi-BOT](https://github.com/SilveryStar/Adachi-BOT)衍生插件，用于原神抽卡记录分析！

# 1.使用方法

项目下载后，直接将genshin_draw_analysis文件夹复制到，[原项目](https://github.com/SilveryStar/Adachi-BOT)plugins文件夹下即可。

# 2.命令触发

分析前需先私聊bot（header+draw_url_set+抽卡记录URL）设置抽卡记录URL；关于抽卡记录URL获取，许多抽卡记录分析工具都有说明了，这里就不再描述；实在不知道的可以提交issue；

设置完成后发送header+draw_analysis查询即可

# 3.常见问题

## 3.1返回图片出现字体乱码

出现问题原因为linux中文字体缺失， 可参考 [此文章](https://www.cnblogs.com/helios-fz/p/13706157.html)安装字体后  重启bot

# 4.LICENSE

[LICENSE](https://github.com/wickedll/genshin_draw_analysis/blob/master/LICENSE)