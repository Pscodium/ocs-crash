import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Badge } from '@renderer/components/ui/badge';
import { Plane, TrendingUp, History, PlusIcon } from 'lucide-react';
import { Switch } from '@renderer/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@renderer/components/ui/tooltip"

interface GameResult {
    multiplier: number;
    timestamp: Date;
}

type GamePhase = 'betting' | 'flying' | 'crashed' | 'cooldown';

export default function Game() {
    const [balance, setBalance] = useState(1000);
    const betAmountRef = useRef(10);
    const [betAmount, setBetAmount] = useState(10);
    const autoCashoutRef = useRef(1.0);
    const [autoCashout, setAutoCashout] = useState(1.0);
    const autoCashoutEnabledRef = useRef(false);
    const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
    const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
    const hasBetRef = useRef(false);
    const [hasBet, setHasBet] = useState(false);
    const [gameHistory, setGameHistory] = useState<GameResult[]>([]);
    const [crashPoint, setCrashPoint] = useState(0);
    const [lastWinMultiplier, setLastWinMultiplier] = useState<number | null>(null);
    const [lastProfit, setLastProfit] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(5);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const phaseTimeoutRef = useRef<NodeJS.Timeout>();
    const countdownIntervalRef = useRef<NodeJS.Timeout>();
    const isGameRunningRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const generateCrashPoint = useCallback(() => {
        const random = Math.random();
        if (random < 0.5) return 1 + Math.random() * 2;
        if (random < 0.8) return 3 + Math.random() * 7;
        if (random < 0.95) return 10 + Math.random() * 40;
        return 50 + Math.random() * 450;
    }, []);

    const drawGraph = useCallback(
        (multiplier: number, crashed = false) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width / window.devicePixelRatio - 20;
            const height = canvas.height / window.devicePixelRatio - 14;
            const lineColor = crashed ? '#ef4444' : '#10b981';

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#0f172a';
            canvas.style.justifyContent = 'center';
            canvas.style.alignItems = 'center';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, lineColor);
            gradient.addColorStop(1, 'transparent');

            const maxDisplayMultiplier = 10;
            const baseProgress = Math.min((multiplier - 1) / (maxDisplayMultiplier - 1), 1);
            const totalProgress = (multiplier - 1) / (maxDisplayMultiplier - 1);
            const maxCurveHeight = height - 20;
            const progressX = baseProgress * width;

            ctx.beginPath();
            ctx.moveTo(0, height + 2);

            for (let x = 0; x <= progressX; x += 2) {
                const normalizedX = x / width;

                let y;
                if (totalProgress <= 1) {
                    y = height - Math.pow(normalizedX, 1.1) * baseProgress * maxCurveHeight;
                } else {
                    const excessProgress = totalProgress - 1;
                    const dynamicExponent = 1.1 + excessProgress * 1.1;
                    const curveValue = Math.pow(normalizedX, Math.min(dynamicExponent, 5));
                    y = height - curveValue * maxCurveHeight;
                }

                ctx.lineTo(x, y);
            }

            ctx.lineTo(progressX - 1, height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let x = 0; x <= progressX; x += 2) {
                const normalizedX = x / width;

                let y;
                if (totalProgress <= 1) {
                    y = height - Math.pow(normalizedX, 1.1) * baseProgress * maxCurveHeight;
                } else {
                    const excessProgress = totalProgress - 1;
                    const dynamicExponent = 1.1 + excessProgress * 1.1;
                    const curveValue = Math.pow(normalizedX, Math.min(dynamicExponent, 5));
                    y = height - curveValue * maxCurveHeight;
                }

                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            if (crashed) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.stroke();
            }

            const ballX = progressX;
            const normalizedX = ballX / width;
            let ballY;
            if (totalProgress <= 1) {
                ballY = height - Math.pow(normalizedX, 1.1) * baseProgress * maxCurveHeight;
            } else {
                const excessProgress = totalProgress - 1;
                const dynamicExponent = 1.1 + excessProgress * 1.1;
                const curveValue = Math.pow(normalizedX, Math.min(dynamicExponent, 5));
                ballY = height - curveValue * maxCurveHeight;
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(ballX, ballY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = ctx.createRadialGradient(ballX - 6, ballY - 6, 6, ballX, ballY, 16);
            ctx.fillStyle.addColorStop?.(0, lineColor);
            ctx.fillStyle.addColorStop?.(1, lineColor);
            ctx.fillStyle = lineColor;
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = lineColor;
            ctx.stroke();
            ctx.restore();
        },
        [gamePhase]
    );

    const clearAllTimers = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = undefined;
        }
        if (phaseTimeoutRef.current) {
            clearTimeout(phaseTimeoutRef.current);
            phaseTimeoutRef.current = undefined;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = undefined;
        }
    }, []);

    const startFlying = useCallback(() => {
        if (isGameRunningRef.current) {
            console.log('startFlying já está rodando, ignorando chamada duplicada');
            return;
        }

        let autoCashoutAlreadySet = false;
        isGameRunningRef.current = true;
        const newCrashPoint = generateCrashPoint();
        setCrashPoint(newCrashPoint);
        setCurrentMultiplier(1.0);

        console.log(`Novo ponto de crash: ${newCrashPoint.toFixed(2)}x`);

        const startTime = Date.now();

        const gameLoop = () => {
            if (!isGameRunningRef.current) {
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const newMultiplier = 1 + Math.pow(elapsed, 1.5) * 0.3;

            setCurrentMultiplier(newMultiplier);
            drawGraph(newMultiplier);

            if (!autoCashoutAlreadySet && newMultiplier.toFixed(2) >= autoCashoutRef.current.toFixed(2)) {
                if (autoCashoutEnabledRef.current && hasBetRef.current) {
                    autoCashOut(autoCashoutRef.current);
                }
                autoCashoutAlreadySet = true;
            }

            if (newMultiplier >= newCrashPoint) {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                    animationRef.current = undefined;
                }

                isGameRunningRef.current = false;
                setCurrentMultiplier(newCrashPoint);
                setGamePhase('crashed');
                autoCashoutAlreadySet = false;

                setTimeout(() => {
                    drawGraph(newCrashPoint, true);
                }, 0);

                if (hasBetRef.current) {
                    updateHasBet(false);
                }

                setGameHistory((prev) => [
                    {
                        multiplier: newCrashPoint,
                        timestamp: new Date(),
                    },
                    ...prev.slice(0, 30),
                ]);

                phaseTimeoutRef.current = setTimeout(() => {
                    startBettingCountdown();
                }, 3000);
            } else {
                animationRef.current = requestAnimationFrame(gameLoop);
            }
        };

        gameLoop();
    }, [generateCrashPoint, hasBetRef, autoCashoutEnabledRef, autoCashoutRef, drawGraph, autoCashoutEnabled]);

    const startBettingCountdown = useCallback(() => {
        clearAllTimers();
        isGameRunningRef.current = false;

        setGamePhase('betting');
        setTimeRemaining(5);
        setCurrentMultiplier(1.0);
        updateHasBet(false);
        setLastWinMultiplier(null);
        setLastProfit(null);
        setCrashPoint(0);
        cleanupGame();

        countdownIntervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current!);
                    phaseTimeoutRef.current = setTimeout(() => {
                        setGamePhase('flying');
                        startFlying();
                    }, 100);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearAllTimers, startFlying]);

    const cleanupGame = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = '#10b981';
                ctx.fillStyle = 'transparent';
            }
        }
    }, [canvasRef]);

    const placeBet = () => {
        if (gamePhase !== 'betting' || betAmount > balance || betAmount <= 0 || timeRemaining === 0) return;

        setBalance((prev) => prev - betAmount);
        updateHasBet(true);
        setLastWinMultiplier(null);
        setLastProfit(null);
    };

    const updateHasBet = (value: boolean) => {
        hasBetRef.current = value;
        setHasBet(value);
    };

    const updateCashOut = (value: number) => {
        autoCashoutRef.current = value;
        setAutoCashout(value);
    };

    const updateBetAmount = (value: number) => {
        betAmountRef.current = value;
        setBetAmount(value);
    };

    const updateAutoCashoutEnabled = (value: boolean) => {
        autoCashoutEnabledRef.current = value;
        setAutoCashoutEnabled(value);
    };

    const cashOut = () => {
        if (gamePhase !== 'flying' || !hasBetRef.current) return;

        const winAmount = betAmount * currentMultiplier;
        setBalance((prev) => prev + winAmount);
        setLastWinMultiplier(currentMultiplier);
        setLastProfit(winAmount - betAmount);
        updateHasBet(false);
    };

    const autoCashOut = (value: number) => {
        if (!hasBetRef.current) return;
        const winAmount = betAmountRef.current * value;
        setBalance((prev) => prev + winAmount);
        setLastWinMultiplier(value);
        setLastProfit(winAmount - betAmountRef.current);
        updateHasBet(false);
    };

    useEffect(() => {
        if (!isGameRunningRef.current) {
            const timer = setTimeout(startBettingCountdown, 1000);

            return () => {
                clearTimeout(timer);
                clearAllTimers();
            };
        }
        return undefined;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const el = scrollRef.current;
        if (!canvas || !el) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        };

        const onWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY + 20;
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            el.removeEventListener('wheel', onWheel);
        };
    }, []);

    const getStateText = () => {
        switch (gamePhase) {
            case 'betting':
                return timeRemaining > 0 ? `Apostas abertas - ${timeRemaining}s` : 'Apostas fechadas';
            case 'flying':
                return 'Voando!';
            case 'crashed':
                return `Crashed em ${crashPoint.toFixed(2)}x`;
            default:
                return 'Aguardando...';
        }
    };

    const debugMode = () => {
        startBettingCountdown();
        for (let i = 0; i < 10; i++) {
            setGameHistory((prev) => [
                {
                    multiplier: generateCrashPoint(),
                    timestamp: new Date(Date.now() - i * 60000),
                },
                ...prev,
            ]);
        }
        setBalance(1000);
    };

    const canBet = gamePhase === 'betting' && timeRemaining > 0;
    const canCashOut = gamePhase === 'flying' && hasBet;

    return (
        <div className='min-h-screen w-full bg-gradient-to-br from-slate-800 via-gray-900 to-slate-800 p-4'>
            <button className='absolute top-4 text-white' onClick={debugMode}>
                debug mode
            </button>
            <div className='max-w-7xl mx-auto space-y-6'>
                <div className='text-center space-y-2'>
                    <h1 className='text-4xl font-bold text-white flex items-center justify-center p-5 gap-2'>
                        <Plane className='text-blue-400' />
                        Crash Game
                    </h1>
                </div>
                <div className='w-full min-h-full grid grid-cols-6 lg:grid-cols-6 gap-6'>
                    <div className='col-span-6 lg:col-span-4'>
                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardHeader className='pb-2'>
                                <div className='flex items-center justify-between'>
                                    <CardTitle className='text-white flex items-center gap-2'>
                                        <TrendingUp className='text-green-400' />
                                        Multiplicador Atual
                                    </CardTitle>
                                    <div className='text-right'>
                                        <div className='text-3xl font-bold text-white'>{currentMultiplier.toFixed(2)}x</div>
                                        <Badge variant={gamePhase === 'crashed' ? 'destructive' : gamePhase === 'flying' ? 'default' : 'secondary'}>{getStateText()}</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className='p-2'>
                                <div className='relative overflow-visible'>
                                    {lastWinMultiplier && <Badge className='text-white top-1 right-1 font-bold bg-green-400/60 absolute animate-pulse'>Cashout x{lastWinMultiplier.toFixed(2)}</Badge>}
                                    <canvas ref={canvasRef} className='w-full h-64 pl-4 bg-transparent rounded-lg' style={{ overflow: 'visible', width: '100%', height: '300px' }} />
                                    {gamePhase === 'crashed' && (
                                        <div className='absolute inset-0 flex items-center justify-center'>
                                            <div className='text-6xl animate-bounce'>💥</div>
                                        </div>
                                    )}
                                    {gamePhase === 'betting' && (
                                        <div className='absolute inset-0 flex items-center justify-center'>
                                            <div className='text-center text-white'>
                                                {timeRemaining > 0 ? (
                                                    <>
                                                        <div className='text-4xl font-bold mb-2'>{timeRemaining}</div>
                                                        <div className='text-lg'>Faça suas apostas!</div>
                                                    </>
                                                ) : (
                                                    <div className='text-lg'>Apostas fechadas - Preparando voo...</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className='col-span-6 lg:col-span-2 gap-4 flex flex-col'>
                        <Card className='bg-slate-800/50 border-slate-700 h-full'>
                            <CardHeader>
                                <CardTitle className='text-white text-lg'>Apostar</CardTitle>
                            </CardHeader>
                            <CardContent className='min-h-full gap-2 flex flex-col'>
                                <div>
                                    <label className='text-sm text-gray-300 mb-2 block'>Auto Cashout</label>
                                    <div className='flex items-center w-full gap-2'>
                                        <Input
                                            type='number'
                                            value={autoCashout.toFixed(2)}
                                            onChange={(e) => updateCashOut(Number(e.target.value))}
                                            className='bg-slate-700 border-slate-600 text-white'
                                            disabled={!canBet}
                                            step='0.01'
                                            placeholder='1.00'
                                            min='1.00'
                                        />
                                        <Switch disabled={!canBet} checked={autoCashoutEnabled} onCheckedChange={(checked) => updateAutoCashoutEnabled(checked)} />
                                    </div>
                                </div>
                                <div>
                                    <label className='text-sm text-gray-300 mb-2 block'>Valor da Aposta</label>
                                    <Input
                                        type='number'
                                        value={betAmount.toFixed()}
                                        onChange={(e) => updateBetAmount(Number(e.target.value))}
                                        className='bg-slate-700 border-slate-600 text-white'
                                        disabled={!canBet}
                                        min='1'
                                        max={balance}
                                    />
                                </div>

                                <div className='grid grid-cols-2 gap-2'>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => updateBetAmount(Math.max(1, betAmountRef.current / 2))}
                                        disabled={!canBet}
                                        className='border-slate-600 text-white hover:bg-slate-700'
                                    >
                                        1/2
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => updateBetAmount(Math.min(balance, betAmountRef.current * 2))}
                                        disabled={!canBet}
                                        className='border-slate-600 text-white hover:bg-slate-700'
                                    >
                                        2x
                                    </Button>
                                </div>

                                {!hasBet ? (
                                    <Button onClick={placeBet} disabled={!canBet || betAmount > balance || betAmount <= 0} className='w-full bg-blue-600 hover:bg-blue-700'>
                                        {!canBet ? (gamePhase === 'betting' ? `Aguarde - ${timeRemaining}s` : 'Aguarde próxima rodada') : `Apostar R$ ${betAmount.toFixed(2)}`}
                                    </Button>
                                ) : (
                                    <Button onClick={cashOut} disabled={!canCashOut} className={`w-full ${canCashOut ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-gray-600'}`}>
                                        {canCashOut ? `Cash Out R$ ${(betAmount * currentMultiplier).toFixed(2)}` : gamePhase === 'betting' ? 'Aguarde o voo...' : 'Perdeu!'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div className='lg:col-span-2 col-span-6 h-full'>
                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardContent className='p-2 h-40 gap-1 flex items-center justify-center'>
                                <div className='text-center flex items-center flex-col'>
                                    <div className='text-white font-bold'>Saldo</div>
                                    <div className='flex gap-2 items-center'>
                                        <div className='text-2xl font-bold text-white'>R$ {balance.toFixed(2)}</div>
                                        <Button onClick={() => setBalance(balance + 1000)} className='border-green-400 border hover:bg-green-400/20 h-[25px] w-[25px] p-1'>
                                            <PlusIcon className='stroke-green-400 h-[20px] w-[20px]' />
                                        </Button>
                                    </div>
                                    {lastProfit && (
                                        <Badge className='pt-1' variant='default'>
                                            Lucro: +R$ {lastProfit.toFixed(2)}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className='col-span-6 lg:col-span-4'>
                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardHeader>
                                <CardTitle className='text-white text-lg flex items-center gap-2'>
                                    <History className='w-5 h-5' />
                                    Histórico
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div ref={scrollRef} className='h-[60px] flex gap-3 overflow-x-auto scroll-smooth'>
                                    {gameHistory.map((result, index) => (
                                        <div key={index} className='flex h-10 justify-between items-center rounded'>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Badge className='p-3' variant={result.multiplier >= 2 ? 'default' : result.multiplier >= 1.5 ? 'secondary' : 'destructive'}>
                                                            {result.multiplier.toFixed(2)}x
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent side='bottom' className='bg-gray-200'>
                                                        <p>{result.timestamp.toLocaleTimeString()}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    ))}
                                    {gameHistory.length === 0 && <div className='text-center text-gray-400 text-sm py-4'>Nenhum jogo ainda</div>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
