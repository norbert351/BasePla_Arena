import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Word Pools ───
const EASY_WORDS = [
  'play','fast','game','win','score','tap','move','run','jump','start',
  'stop','time','click','press','type','level','speed','match','rank','best',
  'top','try','again','focus','skill','sharp','quick','clear','stack','block',
  'drop','line','grid','tile','spin','push','pull','aim','hit','miss',
];

const MEDIUM_WORDS = [
  'player','action','timing','motion','result','record','points','challenge',
  'compete','improve','practice','control','reaction','balance','system','design',
  'feature','session','progress','pattern','connect','manage','update','display',
  'trigger','submit','handle','render','input','output',
];

const HARD_WORDS = [
  'performance','interaction','synchronization','configuration','optimization',
  'implementation','acceleration','responsiveness','navigation','visualization',
  'calculation','architecture','functionality','development','experience',
  'scalability','integration','processing','simulation','evaluation',
];

const CRYPTO_WORDS = [
  'airdrop','whitelist','presale','onchain','offchain','governance','dao',
  'treasury','yield','farming','collateral','oracle','indexer','zkrollup',
  'optimism','arbitrum','mainnet','testnet','base','coinbase','ethereum',
  'blockchain','crypto','token','wallet','address','transaction','gas',
  'gasfee','network','layer2','rollup','contract','smartcontract','protocol',
  'liquidity','staking','validator','bridge','swap','dex','defi','nft',
  'mint','burn','signature','node','rpc','explorer','chain','ledger',
  'security','hash','encryption','decentralization','interoperability','infrastructure',
];

const NORMAL_WORDS = [...EASY_WORDS, ...MEDIUM_WORDS, ...HARD_WORDS];

export type WordMode = 'normal' | 'crypto';
export type GamePhase = 'idle' | 'countdown' | 'playing' | 'finished';

const GAME_DURATION = 120; // seconds (2 minutes)
const COUNTDOWN_SECONDS = 3;

function pickWord(mode: WordMode): string {
  if (mode === 'crypto') {
    return CRYPTO_WORDS[Math.floor(Math.random() * CRYPTO_WORDS.length)];
  }
  // 70% normal, 30% crypto
  if (Math.random() < 0.7) {
    return NORMAL_WORDS[Math.floor(Math.random() * NORMAL_WORDS.length)];
  }
  return CRYPTO_WORDS[Math.floor(Math.random() * CRYPTO_WORDS.length)];
}

export interface TypingGameState {
  phase: GamePhase;
  countdown: number;
  timeLeft: number;
  currentWord: string;
  input: string;
  wpm: number;
  accuracy: number;
  finalScore: number;
  streak: number;
  bestStreak: number;
  correctWords: number;
  totalAttempts: number;
  wordMode: WordMode;
}

export function useTypingGame() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [correctWords, setCorrectWords] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [wordMode, setWordMode] = useState<WordMode>('normal');
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [finalScore, setFinalScore] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const nextWord = useCallback((mode: WordMode) => {
    setCurrentWord(pickWord(mode));
    setInput('');
  }, []);

  const startGame = useCallback((mode: WordMode = 'normal') => {
    clearTimer();
    setWordMode(mode);
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECONDS);
    setTimeLeft(GAME_DURATION);
    setCorrectWords(0);
    setTotalAttempts(0);
    setStreak(0);
    setBestStreak(0);
    setWpm(0);
    setAccuracy(100);
    setFinalScore(0);
    setInput('');
    setCurrentWord(pickWord(mode));

    let c = COUNTDOWN_SECONDS;
    timerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearTimer();
        setPhase('playing');
        startTimeRef.current = Date.now();

        let t = GAME_DURATION;
        timerRef.current = setInterval(() => {
          t -= 1;
          setTimeLeft(t);
          if (t <= 0) {
            clearTimer();
            setPhase('finished');
          }
        }, 1000);
      }
    }, 1000);
  }, [clearTimer]);

  // Compute live WPM
  useEffect(() => {
    if (phase === 'playing' && correctWords > 0) {
      const elapsed = (Date.now() - startTimeRef.current) / 60000; // minutes
      if (elapsed > 0) setWpm(Math.round(correctWords / elapsed));
    }
  }, [correctWords, phase, timeLeft]);

  // Compute accuracy
  useEffect(() => {
    if (totalAttempts > 0) {
      setAccuracy(Math.round((correctWords / totalAttempts) * 100));
    }
  }, [correctWords, totalAttempts]);

  // Compute final score
  useEffect(() => {
    if (phase === 'finished') {
      const elapsed = (Date.now() - startTimeRef.current) / 60000;
      const finalWpm = elapsed > 0 ? Math.round(correctWords / elapsed) : 0;
      const finalAcc = totalAttempts > 0 ? Math.round((correctWords / totalAttempts) * 100) : 0;
      setWpm(finalWpm);
      setAccuracy(finalAcc);
      // New scoring formula: rewards speed, accuracy, and consistency
      const score =
        Math.floor(finalWpm * 10) +
        Math.floor(finalAcc * 2) +
        Math.floor(bestStreak * 3);
      setFinalScore(Math.max(0, score));
    }
  }, [phase, correctWords, totalAttempts, bestStreak]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleInput = useCallback((value: string) => {
    if (phase !== 'playing') return;

    // If user types a space or the value ends with space, check the word
    if (value.endsWith(' ')) {
      const typed = value.trim().toLowerCase();
      const target = currentWord.toLowerCase();
      setTotalAttempts(prev => prev + 1);

      if (typed === target) {
        setCorrectWords(prev => prev + 1);
        setStreak(prev => {
          const next = prev + 1;
          setBestStreak(b => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }
      nextWord(wordMode);
      return;
    }

    setInput(value);
  }, [phase, currentWord, wordMode, nextWord]);

  const resetGame = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setCountdown(COUNTDOWN_SECONDS);
    setTimeLeft(GAME_DURATION);
    setInput('');
    setCurrentWord('');
    setCorrectWords(0);
    setTotalAttempts(0);
    setStreak(0);
    setBestStreak(0);
    setWpm(0);
    setAccuracy(100);
    setFinalScore(0);
  }, [clearTimer]);

  // Get input match status for coloring
  const getInputStatus = useCallback((): 'neutral' | 'correct' | 'incorrect' => {
    if (!input || !currentWord) return 'neutral';
    const target = currentWord.toLowerCase();
    const typed = input.toLowerCase();
    if (target.startsWith(typed)) return 'correct';
    return 'incorrect';
  }, [input, currentWord]);

  return {
    phase,
    countdown,
    timeLeft,
    currentWord,
    input,
    wpm,
    accuracy,
    finalScore,
    streak,
    bestStreak,
    correctWords,
    totalAttempts,
    wordMode,
    startGame,
    handleInput,
    resetGame,
    getInputStatus,
  };
}
