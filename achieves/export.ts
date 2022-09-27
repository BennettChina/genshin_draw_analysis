import { InputParameter, Order } from "@modules/command";
import {
	Gacha_Info,
	Standard_Gacha,
	Standard_Gacha_Data,
	Standard_Gacha_Excel,
	Standard_Gacha_Excel_Origin_Data,
	Standard_Gacha_Info
} from "#genshin_draw_analysis/util/types";
import moment from "moment";
import fs from "fs";
import { resolve } from "path";
import { isGroupMessage, isPrivateMessage } from "@modules/message";
import {
	convert2Lang,
	convert2Readable,
	get_sheet_name,
	getColor,
	upload2Qiniu
} from "#genshin_draw_analysis/util/util";

import { randomSecret } from "@modules/utils";
import { gacha_config } from "#genshin_draw_analysis/init";
import bot from "ROOT";

const gacha_types = [ "301", "400", "302", "100", "200" ];

async function export2JSON( export_data: Standard_Gacha, {
	file,
	sendMessage,
	messageData,
	client,
	redis,
	logger,
	auth
}: InputParameter ) {
	const json = JSON.stringify( export_data );
	const file_name = `UIGF-${ export_data.info.uid }-${ moment( export_data.info.export_timestamp * 1000 ).format( "yyMMDDHHmmss" ) }.json`;
	const tmp_path = resolve( file.root, 'tmp' );
	if ( !fs.existsSync( tmp_path ) ) {
		fs.mkdirSync( tmp_path );
	}
	const export_json_path = resolve( tmp_path, file_name );
	const opened: number = fs.openSync( export_json_path, "w" );
	fs.writeSync( opened, json );
	fs.closeSync( opened );
	if ( gacha_config.qiniuOss.enable ) {
		try {
			// 上传到 OSS
			const url: string = await upload2Qiniu( export_json_path, file_name, gacha_config.qiniuOss, redis );
			// 导出后删掉临时文件
			fs.unlinkSync( export_json_path );
			await sendMessage( `抽卡记录文件已导出，可在浏览器访问 ${ url } 下载查看。` );
			return;
		} catch ( error ) {
			logger.error( "抽卡记录导出成功，上传 OSS 失败！", error );
			const CALL = <Order>bot.command.getSingle( "adachi.call", await auth.get( messageData.user_id ) );
			const appendMsg = CALL ? `私聊使用 ${ CALL.getHeaders()[0] } ` : "";
			await sendMessage( `文件导出成功，上传云存储失败，请${ appendMsg }联系 BOT 持有者反馈该问题。` );
			// 删掉避免占用空间，有需求重新生成。
			fs.unlinkSync( export_json_path );
		}
	}
	if ( isGroupMessage( messageData ) ) {
		await client.acquireGfs( messageData.group_id ).upload( export_json_path );
		// 导出后删掉临时文件
		fs.unlinkSync( export_json_path );
		await sendMessage( `抽卡记录文件已导出至${ file_name }` );
	}
}


async function addRowAndSetStyle( sheet, data: Standard_Gacha_Excel ) {
	const row = sheet.addRow( data );
	row.eachCell( { includeEmpty: true }, cell => {
		cell.alignment = {
			horizontal: 'center',
			vertical: 'middle'
		}
		cell.font = {
			color: { argb: getColor( data.rank_type ) },
			bold: data.rank_type === "5"
		}
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'ffebebeb' }
		}
		cell.border = {
			top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
		}
	} );
	row.commit();
}

function setHeaderStyle( headers: string[], sheet ) {
	headers.forEach( ( value, index ) => {
		const cell = sheet.getCell( 1, index + 1 );
		cell.border = {
			top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
		}
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'ffdbd7d3' },
		}
		cell.font = {
			color: { argb: "ff757575" },
			bold: true
		}
		cell.alignment = {
			horizontal: 'center',
			vertical: 'middle'
		}
	} );
}

async function export2Excel( {
	                             info: { uid, lang, export_timestamp },
	                             list
                             }: Standard_Gacha, {
	                             file,
	                             client,
	                             messageData,
	                             sendMessage,
	                             redis,
	                             logger,
	                             auth
                             }: InputParameter ) {
	// 按照 ID 升序排列
	list = list.sort( ( a, b ) => {
		const n1 = parseInt( a.id || "0", 10 );
		const n2 = parseInt( b.id || "0", 10 );
		if ( n1 > n2 ) {
			return 1;
		} else if ( n1 === n2 ) {
			return 0;
		} else {
			return -1;
		}
	} )
	const gacha_csv_objects: Standard_Gacha_Excel[] = list.map( ( {
		                                                              time,
		                                                              name,
		                                                              gacha_type,
		                                                              rank_type,
		                                                              item_type
	                                                              } ) => ( {
		time,
		name,
		item_type,
		rank_type,
		gacha_type
	} ) );
	const ExcelJS = require( 'exceljs' );
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'adachi-bot';
	workbook.lastModifiedBy = 'adachi-bot';
	workbook.created = new Date();
	workbook.modified = new Date();
	
	
	const sheet_names: string[] = gacha_types.filter( value => value !== '400' );
	for ( let type of sheet_names ) {
		const sheet = workbook.addWorksheet( get_sheet_name( type ), {
			views: [ {
				state: 'frozen',
				ySplit: 1,
				zoomScale: 260
			} ]
		} );
		let width = [ 24, 14, 8, 8, 20 ]
		if ( !lang.includes( 'zh-' ) ) {
			width = [ 24, 32, 16, 12, 24 ]
		}
		const headers = Object.keys( gacha_csv_objects[0] );
		sheet.columns = headers.map( ( key, index ) => {
			return {
				header: convert2Lang( key, lang ),
				key,
				width: width[index]
			}
		} );
		setHeaderStyle( headers, sheet );
		const filter_gacha_data: Standard_Gacha_Excel[] = gacha_csv_objects.filter( ( { gacha_type } ) => {
			return type === '301' && gacha_type === '400' ? true : gacha_type === type;
		} );
		
		for ( let data of filter_gacha_data ) {
			data.gacha_type = convert2Readable( data.gacha_type, lang );
			await addRowAndSetStyle( sheet, data );
		}
		// 设置保护模式，避免用户随意修改内容
		await sheet.protect( randomSecret( 20 ), {
			formatCells: true,
			formatRows: true,
			formatColumns: true,
			sort: true,
			autoFilter: true,
			pivotTables: true
		} );
	}
	
	// 添加一个原始数据的表
	const sheet = workbook.addWorksheet( "原始数据", {
		views: [ {
			state: 'frozen',
			ySplit: 1,
			zoomScale: 260
		} ]
	} );
	let width = [ 24, 18, 8, 12, 12, 12, 8, 24, 20, 12, 18 ]
	if ( !lang.includes( 'zh-' ) ) {
		width = [ 24, 24, 8, 12, 12, 12, 8, 24, 20, 12, 18 ]
	}
	const origin_data_list: Standard_Gacha_Excel_Origin_Data[] = list.map( ( data: Standard_Gacha_Data ) => {
		return {
			...data,
			lang,
			uid
		}
	} );
	const headers = Object.keys( origin_data_list[0] );
	sheet.columns = headers.map( ( key, index ) => {
		return {
			header: key,
			key,
			width: width[index]
		}
	} );
	setHeaderStyle( headers, sheet );
	for ( const data of origin_data_list ) {
		await addRowAndSetStyle( sheet, data );
	}
	// 设置保护模式，避免用户随意修改内容
	await sheet.protect( randomSecret( 20 ), {
		formatCells: true,
		formatRows: true,
		formatColumns: true,
		sort: true,
		autoFilter: true,
		pivotTables: true
	} );
	
	const file_name = `UIGF-${ uid }-${ moment( export_timestamp * 1000 ).format( "yyMMDDHHmmss" ) }.xlsx`;
	const tmp_path = resolve( file.root, 'tmp' );
	if ( !fs.existsSync( tmp_path ) ) {
		fs.mkdirSync( tmp_path );
	}
	const export_excel_path = resolve( tmp_path, file_name );
	await workbook.xlsx.writeFile( export_excel_path );
	
	if ( gacha_config.qiniuOss.enable ) {
		// 上传到 OSS
		try {
			const url: string = await upload2Qiniu( export_excel_path, file_name, gacha_config.qiniuOss, redis );
			// 导出后删掉临时文件
			fs.unlinkSync( export_excel_path );
			await sendMessage( `抽卡记录文件已导出，可在浏览器访问 ${ url } 下载查看。` );
			return;
		} catch ( error ) {
			logger.error( "抽卡记录导出成功，上传 OSS 失败！", error );
			const CALL = <Order>bot.command.getSingle( "adachi.call", await auth.get( messageData.user_id ) );
			const appendMsg = CALL ? `私聊使用 ${ CALL.getHeaders()[0] } ` : "";
			await sendMessage( `文件导出成功，上传云存储失败，请${ appendMsg }联系 BOT 持有者反馈该问题。` );
			// 删掉避免占用空间，有需求重新生成。
			fs.unlinkSync( export_excel_path );
			return;
		}
	}
	if ( isGroupMessage( messageData ) ) {
		await client.acquireGfs( messageData.group_id ).upload( export_excel_path );
		// 导出后删掉临时文件
		fs.unlinkSync( export_excel_path );
		await sendMessage( `抽卡记录文件已导出至${ file_name }` );
	}
}

export async function main( bot: InputParameter ): Promise<void> {
	const { sendMessage, messageData, redis } = bot;
	if ( !gacha_config.qiniuOss.enable && isPrivateMessage( messageData ) ) {
		await sendMessage( '未启用 OSS 存储，暂不支持私聊导出文件' );
		return;
	}
	
	const { user_id, raw_message } = messageData;
	const gacha_data_list: Standard_Gacha_Data[] = [];
	// 获取存储的抽卡记录数据
	const uid: string = await redis.getString( `genshin_draw_analysis_curr_uid-${ user_id }` );
	let lang: string = "zh-cn";
	for ( let gacha_type of gacha_types ) {
		const gacha_data_map: Record<string, string> = await redis.getHash( `genshin_draw_analysis_data-${ gacha_type }-${ uid }` );
		const gacha_data_strings: string[] = Object.values( gacha_data_map );
		for ( let gacha_data_str of gacha_data_strings ) {
			const gacha_data: Gacha_Info = JSON.parse( gacha_data_str );
			lang = gacha_data.lang;
			const export_gacha_data: Standard_Gacha_Data = {
				id: gacha_data.id,
				name: gacha_data.name,
				item_id: gacha_data.item_id,
				item_type: gacha_data.item_type,
				rank_type: gacha_data.rank_type,
				gacha_type: gacha_data.gacha_type,
				count: gacha_data.count,
				time: gacha_data.time,
				uigf_gacha_type: gacha_data.gacha_type === "400" ? "301" : gacha_data.gacha_type
			};
			gacha_data_list.push( export_gacha_data );
		}
	}
	
	const info: Standard_Gacha_Info = {
		uid,
		lang,
		export_app: '-',
		export_app_version: '1.0.0',
		export_time: moment().format( "yy-MM-DD HH:mm:ss" ),
		export_timestamp: Date.now() / 1000 | 0,
		uigf_version: '2.2'
	}
	const export_data: Standard_Gacha = {
		info,
		list: gacha_data_list
	}
	
	if ( raw_message === 'json' ) {
		await export2JSON( export_data, bot );
	} else if ( raw_message === 'excel' ) {
		await export2Excel( export_data, bot );
	} else {
		await sendMessage( `不支持的导出类型: ${ raw_message }` );
	}
}