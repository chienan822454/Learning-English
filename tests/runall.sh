#!/bin/bash
# 一次跑完全部自動測試。用法：bash runall.sh 網站資料夾 版本號 快取名稱
#   例：bash runall.sh /tmp/site V5.20.0 english-5000-v5-20-0
# 需要：tests/old（V5.15）與 tests/prev（V5.16.20）兩個舊版本資料夾（升版測試用）。
# 有任何一項失敗（或測試程式本身出錯）時，結束代碼為 1。
cd "$(dirname "$0")"
mkdir -p /tmp/t5
rm -rf site && cp -r "$1" site
export VER="$2" CACHE="$3"
fail=0
summary=""
check(){ # 名稱 結果檔 程式結束代碼
  local p f
  p=$(grep -cE '^PASS' "$2"); f=$(grep -c '^FAIL' "$2")
  echo "$1 $p pass $f fail"; grep '^FAIL' "$2"
  summary="$summary $1:$p/$f"
  if [ "$f" != "0" ] || [ "$p" = "0" ] || [ "$3" != "0" ]; then
    fail=1
    [ "$3" != "0" ] && { echo "  （$1 測試程式結束代碼 $3）"; tail -5 "$2"; }
    if [ -n "$GITHUB_ACTIONS" ]; then   # GitHub 自動測試：把失敗項目顯示在結果頁上方
      grep '^FAIL' "$2" | head -8 | while IFS= read -r line; do echo "::error title=$1 測試失敗::${line:0:900}"; done
      [ "$3" != "0" ] && echo "::error title=$1 測試程式出錯（代碼 $3）::$(tail -6 "$2" | tr '\n' ' ' | cut -c1-900)"
    fi
  fi
}
for t in rec ui upg ver sess mig words cloze sr3 sr4 fast stuck bk save dlg p6 p7 p8 p9 p10 p11 p12 p13 p14 p15 p16 p17 p18 p19 p20 p21 p22 p23 p24 p25 p26 p27; do
  timeout 600 node ${t}_test.js > /tmp/res_$t.txt 2>&1; check $t /tmp/res_$t.txt $?
done
timeout 600 node monkey.js > /tmp/res_monkey.txt 2>&1; check monkey /tmp/res_monkey.txt $?
node dv.js site/data.js results_data.json > /tmp/res_data.txt 2>&1; check data /tmp/res_data.txt $?
if [ $fail = 0 ]; then echo "全部通過"; else echo "有測試失敗"; fi
if [ -n "$GITHUB_ACTIONS" ]; then
  echo "::notice title=測試結果（通過/失敗）::$summary"
  [ -n "$GITHUB_STEP_SUMMARY" ] && { echo "## 自動測試結果（$VER）"; echo; echo "| 測試 | 通過 | 失敗 |"; echo "|---|---|---|"; for x in $summary; do n=${x%%:*}; r=${x#*:}; echo "| $n | ${r%%/*} | ${r#*/} |"; done; } >> "$GITHUB_STEP_SUMMARY"
fi
exit $fail
