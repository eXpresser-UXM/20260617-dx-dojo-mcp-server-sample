import fs from "fs/promises";
import * as csv from "csv/sync";

import STORES from "./storage/_stores.json";
import MENUS from './storage/_menus.json';
import { differenceInDays } from "date-fns";
import { randomInt } from "crypto";

// 例示用データの生成範囲。
// README やハンズオンで見せるサンプルとして、ある程度長い期間の CSV をまとめて作る。
const START_DATE = new Date("2025-01-01");
const END_DATE = new Date("2026-06-16");

/**
 * 指定された範囲内でランダムな整数を生成するヘルパー関数。
 * @param min 最小値 (含む)
 * @param max 最大値 (含む)
 * @returns ランダムな整数
 */
function getRandomInt(min: number, max: number): number {
  // ランダム値を作って、毎回少しずつ違う売上に見せる。
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * Dateオブジェクトを 'YYYYMMDD' 形式の文字列に変換する。
 * @param date Dateオブジェクト
 * @returns YYYYMMDD形式の文字列
 */
function formatDateToCsv(date: Date): string {
  // ファイル名に使いやすいよう、YYYYMMDD 形式へ変換する。
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
  // メニューごとの数量推移を覚えておくための入れ物。
  // 今回のコードでは主に説明用で、将来の拡張で使いやすい形にしている。
  let previousQuantities: Record<string, number> = {};

  console.log(`--- ${storeName} の売上データを生成中... ---`);

  const startDate = new Date(START_DATE);
  let currentDate = new Date(START_DATE);
  const endDate = new Date(END_DATE);

  const promises: Promise<void>[] = [];

  // 各メニューの「その店舗らしさ」を表す基準数量を先に決める。
  // このベースがあることで、日ごとの売上が完全に同じにならない。
  const baseQuantity = MENUS.reduce((acc, menu) => {
    acc[menu.name] = getRandomInt(10, 40);
    return acc;
  }, {} as Record<string, number>);
  
  // 日ごとの売上に少し波をつけるための補正関数。
  // 曜日や経過日数による自然な変化に見せるために使う。
  const jitterRateFunc = (date: Date) => {
    // 曜日による傾向を加味する。
    // 中央の曜日から離れるほど値が大きくなり、売上が増減するイメージを作っている。
    const dayOfWeekEffect = (date.getDay() - 3) ** 2 / 9;
    // 最終的に 0.75 ～ 1.25 程度の揺らぎにする。
    const Jitter = 0.75 + dayOfWeekEffect * 0.5;
    return Jitter;
  }
  // 日数が経つほど少しずつ売上が増えるように見せるための係数。
  // 「新しい日ほど少し売れる」ような見た目を作る。
  const baseupRateFunc = (date: Date) => 1 + differenceInDays(date, startDate) * 0.05;

  // 1日ずつ進めながら、各日付の CSV を作成する。
  while (currentDate <= endDate) {
    const dateStr = formatDateToCsv(currentDate);
    const fileName = `${dateStr}_${storeName}.csv`;
    const records: any[] = [];

    // その日に売れる各メニューの行を作る。
    for (const menu of MENUS) {
      // 基準数量に曜日の変化と日数経過の変化を掛け合わせて、その日のベースを作る。
      const todayBaseQuantity = baseQuantity[menu.name]! * jitterRateFunc(currentDate) * baseupRateFunc(currentDate);
      // そこからさらに少しだけ上下に揺らして、機械的すぎない値にする。
      const quantity = randomInt(Math.round(0.75 * todayBaseQuantity), Math.round(1.25 * todayBaseQuantity));
      // 金額は単価 × 数量で計算する。
      const salesAmount = menu.price * quantity;

      // CSV の列名に合わせて、1 行分のデータをオブジェクトで作る。
      records.push({
        メニュー名: menu.name,
        "単価 (円)": menu.price,
        "売上数量 (個)": quantity,
        "売上金額 (円)": salesAmount,
      });

      // もし今後「前日との差分」を作るときに使えるよう、数量を記録しておく。
      previousQuantities[menu.name] = quantity;
    }

    // 1日分のレコードを CSV 文字列にしてファイルへ書き出す。
    try {
      const csvContent = csv.stringify(records, {
        bom: true,
        header: true,
        columns: ["メニュー名", "単価 (円)", "売上数量 (個)", "売上金額 (円)"],
      });
      promises.push(fs.writeFile(`storage/csv/${fileName}`, csvContent, "utf8"));
      console.log(`✅ ${fileName} を正常に作成しました。`);
    } catch (error) {
      console.error(
        `❌ ファイル書き込みエラーが発生しました: ${fileName}`,
        error,
      );
    }

    // 次の日へ進む。
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // すべてのファイル書き込みが終わるまで待つ。
  await Promise.all(promises);
  console.log(`--- ${storeName} の売上データ生成が完了しました ---\n`);
}

/**
 * メイン実行関数
 */
async function main() {
  console.log("--- 全店舗の売上データ生成処理を開始します ---");

  // まず、読み込んだ店舗一覧とメニュー一覧を確認できるように出力する。
  // ハンズオン時に、どのデータがもとになっているかを見せやすくするため。
  console.log(STORES);
  console.log(MENUS);
  // 各店舗ごとに別々の売上データ生成を走らせる。
  // まとめて並行実行することで、全体の生成時間を短くしている。
  const generationPromises = STORES.map((storeName) =>
    generateStoreSalesData(storeName, randomInt(0, 30)),
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
