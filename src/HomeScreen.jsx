import { Medal, Play, Trophy, YinYang } from "@phosphor-icons/react";
import { formatRecordDate } from "./records.js";

function RankMark({ rank }) {
  if (rank > 3) return <span className="rank-number">{rank}</span>;
  return <Medal className={`rank-medal rank-${rank}`} weight="fill" aria-label={`${rank}位`} />;
}

export function HomeScreen({ records, onStart }) {
  const bestScore = records[0]?.score ?? 0;
  const bestRound = records.reduce((highest, record) => Math.max(highest, record.round), 0);

  return (
    <main className="home-shell">
      <header className="home-header">
        <div className="home-brand" aria-label="爆連！太極拳">
          <span>爆連！</span>
          <strong>太極拳</strong>
          <YinYang weight="fill" aria-hidden="true" />
        </div>
        <p>〜ゆるっと整え！ 爽快パズル道場〜</p>
      </header>

      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title">気をつないで、<br />どこまで整う？</h1>
            <p>玉をなぞって気を集め、太極拳の奥義で強敵を倒そう。敗北するまでのスコアと到達局が修行記録に残ります。</p>
            <button type="button" className="start-game-button" onClick={onStart}>
              <Play weight="fill" />
              対局を始める
            </button>
            <dl className="home-best-stats">
              <div>
                <dt>最高到達</dt>
                <dd>{bestRound ? `第${bestRound}局` : "未記録"}</dd>
              </div>
              <div>
                <dt>最高スコア</dt>
                <dd>{bestScore.toLocaleString("ja-JP")}</dd>
              </div>
            </dl>
          </div>
          <div className="home-panda-scene" aria-hidden="true">
            <span className="home-enso"><i /></span>
            <img className="home-gold-ki" src="/assets/ki-stream.png" alt="" />
            <span className="home-scene-seal"><YinYang weight="fill" /></span>
            <span className="home-ki-particles">
              <i /><i /><i /><i /><i />
            </span>
            <img className="home-scene-panda" src="/assets/panda-hero.png" alt="" />
          </div>
        </section>

        <section className="ranking-panel" aria-labelledby="ranking-title">
          <div className="ranking-heading">
            <Trophy weight="fill" aria-hidden="true" />
            <div>
              <h2 id="ranking-title">修行記録 上位10件</h2>
              <p>スコア順・同点なら到達局順</p>
            </div>
          </div>
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th scope="col">順位</th>
                  <th scope="col">到達</th>
                  <th scope="col">スコア</th>
                  <th scope="col">日付</th>
                </tr>
              </thead>
              <tbody>
                {records.length ? records.map((record, index) => (
                  <tr key={record.id} className={index < 3 ? `top-rank top-rank-${index + 1}` : ""}>
                    <td><RankMark rank={index + 1} /></td>
                    <td>第{record.round}局</td>
                    <td>{record.score.toLocaleString("ja-JP")}</td>
                    <td><time dateTime={record.achievedAt}>{formatRecordDate(record.achievedAt)}</time></td>
                  </tr>
                )) : (
                  <tr className="ranking-empty">
                    <td colSpan="4">まだ記録はありません。最初の修行へ！</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
