import { PluginSetting } from "@modules/plugin";
import { OrderConfig } from "@modules/command";
import { MessageScope } from "@modules/message";
import bot from "ROOT";
import { createServer } from "./server";
import Renderer from "./util/renderer";
export let renderer: Renderer;


const draw_url: OrderConfig = {
	type: "order",
	cmdKey: "genshin.draw.analysis.url",
	desc: [ "原神抽卡记录URL设置", "(记录URL)"],
	headers: [ "draw_url_set"],
	regexps: [ ".+" ],
	main: "achieves/draw_url",
	detail: "设置抽卡记录url",
    scope: MessageScope.Private,
	ignoreCase: false
}

const draw_analysis: OrderConfig = {
	type: "order",
	cmdKey: "genshin.draw.analysis",
	desc: [ "抽卡分析", "" ],
	headers: [ "draw_analysis" ],
	detail: "使用设置的抽卡记录URL重新拉取数据并合并历史数据分析",
	regexps: [ "" ],
	main: "achieves/draw_analysis"
};

const draw_analysis_history: OrderConfig = {
	type: "order",
	cmdKey: "genshin.draw.analysis.history",
	desc: [ "抽卡分析历史记录", "" ],
	headers: [ "draw_analysis_history" ],
	regexps: [ "" ],
	detail: "使用历史数据分析",
	main: "achieves/draw_analysis_history"
};

export async function init(): Promise<PluginSetting> {
	/* 实例化渲染器 */
	renderer = new Renderer(
		"genshin_draw_analysis", "/views",
		58693, "#app"
	);
	createServer(58693, bot.logger);
    return { 
        pluginName: "genshin_draw_analysis", 
        cfgList: [ draw_url, draw_analysis, draw_analysis_history ] 
    };
}