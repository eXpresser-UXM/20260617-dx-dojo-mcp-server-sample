import fs from "fs/promises";
import * as csv from "csv/sync";

import STORES from "./storage/_stores.json";
import MENUS from './storage/_menus.json';
import { differenceInDays } from "date-fns";
import { randomInt } from "crypto";

// 日付範囲設定 (2025-01-01 から 2026-06-16)
const START_DATE = new Date("2025-01-01");
const END_DATE = new Date("2026-06-16");

/**
 * 指定された範囲内でランダムな整数を生成するヘルパー関数。
 * @param min 最小値 (含む)
 * @param max 最大値 (含む)
 * @returns ランダムな整数
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * Dateオブジェクトを 'YYYYMMDD' 形式の文字列に変換する。
 * @param date Dateオブジェクト
 * @returns YYYYMMDD形式の文字列
 */
function formatDateToCsv(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 指定された店舗の売上データを生成し、CSVファイルとして保存する。
 * @param storeName 店舗名
 * @param storeQuantity 店舗の売上数量のベース値
 */
async function generateStoreSalesData(storeName: string, storeQuantity: number): Promise<void> {
  // 過去の数量を追跡するためのマップ (メニュー名 -> 数量)
  let previousQuantities: Record<string, number> = {};

  console.log(`--- ${storeName} の売上データを生成中... ---`);

  const startDate = new Date(START_DATE);
  let currentDate = new Date(START_DATE);
  const endDate = new Date(END_DATE);

  const promises: Promise<void>[] = [];

  // メニューごとに売上数量のベース値をランダムに決定 (10～40の範囲)
  const baseQuantity = MENUS.reduce((acc, menu) => {
    acc[menu.name] = getRandomInt(10, 40);
    return acc;
  }, {} as Record<string, number>); // 全メニューの初期数量の合計
  
  // ベース値に対するランダムな揺らぎを生成するための関数
  const jitterRateFunc = (date: Date) => {
    // 曜日による傾向を加味 (土日は売上が上がり、水曜日は売上が落ちる傾向があると仮定)
    const dayOfWeekEffect = (date.getDay() - 3) ** 2 / 9;
    // 0.75～1.25の範囲で揺らぎを生成
    const Jitter = 0.75 + dayOfWeekEffect * 0.5;
    return Jitter;
  }
  const baseupRateFunc = (date: Date) => 1 + differenceInDays(date, startDate) * 0.05; // 日数経過による全体的な売上増加傾向を加味

  // 日付を1日ずつ進めるループ
  while (currentDate <= endDate) {
    const dateStr = formatDateToCsv(currentDate);
    const fileName = `${dateStr}_${storeName}.csv`;
    const records: any[] = [];

    // 1. メニューごとの売上データを生成
    for (const menu of MENUS) {
      // ベース数量に曜日や経過日数による傾向を加味して、最終的な売上数量のベースを決定
      const todayBaseQuantity = baseQuantity[menu.name]! * jitterRateFunc(currentDate) * baseupRateFunc(currentDate);
      // ベース数量の75%～125%の範囲でランダムに決定
      const quantity = randomInt(Math.round(0.75 * todayBaseQuantity), Math.round(1.25 * todayBaseQuantity));
      // 売上金額の計算
      const salesAmount = menu.price * quantity;

      // CSVヘッダーに合わせてデータを格納
      records.push({
        メニュー名: menu.name,
        "単価 (円)": menu.price,
        "売上数量 (個)": quantity,
        "売上金額 (円)": salesAmount,
      });

      // 次の日の計算のために現在の数量を保存
      previousQuantities[menu.name] = quantity;
    }

    // 2. CSVファイルとして書き出し
    try {
      const csvContent = csv.stringify(records, {
        bom: true, // UTF-8 BOMを付加してExcelでの文字化けを防止
        header: true, // ヘッダー行を出力
        columns: ["メニュー名", "単価 (円)", "売上数量 (個)", "売上金額 (円)"], // ヘッダーを指定
      });
      promises.push(fs.writeFile(`storage/csv/${fileName}`, csvContent, "utf8"));
      console.log(`✅ ${fileName} を正常に作成しました。`);
    } catch (error) {
      console.error(
        `❌ ファイル書き込みエラーが発生しました: ${fileName}`,
        error,
      );
    }

    // 日付を翌日に進める
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 全てのファイル書き込みが完了するのを待機
  await Promise.all(promises);
  console.log(`--- ${storeName} の売上データ生成が完了しました ---\n`);
}

/**
 * メイン実行関数
 */
async function main() {
  console.log("--- 全店舗の売上データ生成処理を開始します ---");

  // 各店舗に対して非同期でデータを生成・保存する
  console.log(STORES);
  console.log(MENUS);
  const generationPromises = STORES.map((storeName) =>
    generateStoreSalesData(storeName, randomInt(0, 30)), // 店ごとに揺らぎが出るようにランダムなベース数量を渡す
  );

  await Promise.all(generationPromises);

  console.log("\n=============================================");
  console.log("✅ 全ての売上データファイルの生成が完了しました。");
}


console.log(`--- start ---\n`);
// プログラムのエントリポイントとしてmain関数を実行
main().catch((err) => {
  console.error("致命的なエラーが発生し、処理を中断しました:", err);
});
