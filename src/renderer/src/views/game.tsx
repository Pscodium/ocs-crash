import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Badge } from '@renderer/components/ui/badge';
import { Plane, TrendingUp, DollarSign, History } from 'lucide-react';

interface GameResult {
    multiplier: number;
    timestamp: Date;
}

type GamePhase = 'betting' | 'flying' | 'crashed' | 'cooldown';

export default function Game() {
    const [balance, setBalance] = useState(1000);
    const [betAmount, setBetAmount] = useState(10);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
    const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
    const [hasBet, setHasBet] = useState(false);
    const [gameHistory, setGameHistory] = useState<GameResult[]>([]);
    const [crashPoint, setCrashPoint] = useState(0);
    const [lastWin, setLastWin] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(5);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const phaseTimeoutRef = useRef<NodeJS.Timeout>();
    const countdownIntervalRef = useRef<NodeJS.Timeout>();
    const isGameRunningRef = useRef(false);

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

            const width = canvas.width / window.devicePixelRatio;
            const height = canvas.height / window.devicePixelRatio;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, crashed ? '#ef4444' : '#10b981');
            gradient.addColorStop(1, 'transparent');

            const maxDisplayMultiplier = 10;
            const baseProgress = Math.min((multiplier - 1) / (maxDisplayMultiplier - 1), 1);
            const totalProgress = (multiplier - 1) / (maxDisplayMultiplier - 1);
            const maxCurveHeight = height;

            ctx.beginPath();
            ctx.moveTo(0, height);

            for (let x = 0; x <= width; x += 2) {
                const normalizedX = x / width;

                let y;
                if (totalProgress <= 1) {
                    y = height - Math.pow(normalizedX, 1.5) * baseProgress * maxCurveHeight;
                } else {
                    const excessProgress = totalProgress - 1;
                    const dynamicExponent = 1.5 + excessProgress * 1.5;
                    const curveValue = Math.pow(normalizedX, Math.min(dynamicExponent, 5));
                    y = height - curveValue * maxCurveHeight;
                }

                ctx.lineTo(x, y);
            }

            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let x = 0; x <= width; x += 2) {
                const normalizedX = x / width;

                let y;
                if (totalProgress <= 1) {
                    y = height - Math.pow(normalizedX, 1.5) * baseProgress * maxCurveHeight;
                } else {
                    const excessProgress = totalProgress - 1;
                    const dynamicExponent = 1.5 + excessProgress * 1.5;
                    const curveValue = Math.pow(normalizedX, Math.min(dynamicExponent, 5));
                    y = height - curveValue * maxCurveHeight;
                }

                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = crashed ? '#ef4444' : '#10b981';
            ctx.lineWidth = 3;
            ctx.stroke();

            if (crashed) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.stroke();
            }

            if (!crashed && gamePhase === 'flying') {
                const planeProgress = Math.min(baseProgress * 0.9, 0.85);
                const planeX = width * planeProgress;

                let planeY;
                if (totalProgress <= 1) {
                    planeY = height - Math.pow(planeProgress, 1.5) * maxCurveHeight - 15;
                } else {
                    const excessProgress = totalProgress - 1;
                    const dynamicExponent = 1.5 + excessProgress * 1.5;
                    const curveValue = Math.pow(planeProgress, Math.min(dynamicExponent, 5));
                    planeY = height - curveValue * maxCurveHeight - 15;
                }

                ctx.font = '20px Arial';
                ctx.fillStyle = '#3b82f6';
                ctx.fillText('✈️', planeX, planeY);
            }
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

            if (newMultiplier >= newCrashPoint) {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                    animationRef.current = undefined;
                }

                isGameRunningRef.current = false;
                setCurrentMultiplier(newCrashPoint);
                setGamePhase('crashed');

                setTimeout(() => {
                    drawGraph(newCrashPoint, true);
                }, 0);

                if (hasBet) {
                    setHasBet(false);
                }

                setGameHistory((prev) => [
                    {
                        multiplier: newCrashPoint,
                        timestamp: new Date(),
                    },
                    ...prev.slice(0, 9),
                ]);

                phaseTimeoutRef.current = setTimeout(() => {
                    startBettingCountdown();
                }, 3000);
            } else {
                animationRef.current = requestAnimationFrame(gameLoop);
            }
        };

        gameLoop();
    }, [generateCrashPoint, hasBet, drawGraph]);

    const startBettingCountdown = useCallback(() => {
        clearAllTimers();
        isGameRunningRef.current = false;

        setGamePhase('betting');
        setTimeRemaining(5);
        setCurrentMultiplier(1.0);
        setHasBet(false);
        setLastWin(null);
        setCrashPoint(0);

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

    const placeBet = () => {
        if (gamePhase !== 'betting' || betAmount > balance || betAmount <= 0 || timeRemaining === 0) return;

        setBalance((prev) => prev - betAmount);
        setHasBet(true);
        setLastWin(null);
    };

    const cashOut = () => {
        if (gamePhase !== 'flying' || !hasBet) return;

        const winAmount = betAmount * currentMultiplier;
        setBalance((prev) => prev + winAmount);
        setLastWin(winAmount);
        setHasBet(false);
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
        if (!canvas) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
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

    const canBet = gamePhase === 'betting' && timeRemaining > 0;
    const canCashOut = gamePhase === 'flying' && hasBet;

    return (
        <div className='min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4'>
            <div className='max-w-6xl mx-auto space-y-6'>
                <div className='text-center space-y-2'>
                    <h1 className='text-4xl font-bold text-white flex items-center justify-center gap-2'>
                        <Plane className='text-blue-400' />
                        Crash Game
                    </h1>
                    <p className='text-gray-300'>Aposte e retire antes do crash!</p>
                </div>

                <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                    <div className='lg:col-span-2'>
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
                            <CardContent>
                                <div className='relative'>
                                    <canvas ref={canvasRef} className='w-full h-64 bg-slate-900/50 rounded-lg' style={{ width: '100%', height: '256px' }} />
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

                    <div className='space-y-4'>
                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardContent className='pt-6'>
                                <div className='text-center space-y-2'>
                                    <div className='flex items-center justify-center gap-2 text-yellow-400'>
                                        <DollarSign className='w-5 h-5' />
                                        <span className='text-sm font-medium'>Saldo</span>
                                    </div>
                                    <div className='text-2xl font-bold text-white'>R$ {balance.toFixed(2)}</div>
                                    {lastWin && <div className='text-green-400 text-sm'>+R$ {lastWin.toFixed(2)} (Cash Out)</div>}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardHeader>
                                <CardTitle className='text-white text-lg'>Apostar</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div>
                                    <label className='text-sm text-gray-300 mb-2 block'>Valor da Aposta</label>
                                    <Input
                                        type='number'
                                        value={betAmount.toFixed()}
                                        onChange={(e) => setBetAmount(Number(e.target.value))}
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
                                        onClick={() => setBetAmount((prev) => Math.max(1, prev / 2))}
                                        disabled={!canBet}
                                        className='border-slate-600 text-white hover:bg-slate-700'
                                    >
                                        1/2
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => setBetAmount((prev) => Math.min(balance, prev * 2))}
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

                                {hasBet && (
                                    <div className='text-center text-sm text-gray-300'>
                                        Aposta: R$ {betAmount.toFixed(2)}
                                        <br />
                                        {gamePhase === 'flying'
                                            ? `Ganho Atual: R$ ${(betAmount * currentMultiplier).toFixed(2)}`
                                            : gamePhase === 'betting'
                                              ? 'Aguardando início do voo...'
                                              : 'Jogo finalizado'}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className='bg-slate-800/50 border-slate-700'>
                            <CardHeader>
                                <CardTitle className='text-white text-lg flex items-center gap-2'>
                                    <History className='w-5 h-5' />
                                    Histórico
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-2 max-h-40 overflow-y-auto'>
                                    {gameHistory.map((result, index) => (
                                        <div key={index} className='flex justify-between items-center p-2 bg-slate-700/50 rounded'>
                                            <span className='text-gray-300 text-sm'>{result.timestamp.toLocaleTimeString()}</span>
                                            <Badge variant={result.multiplier >= 2 ? 'default' : result.multiplier >= 1.5 ? 'secondary' : 'destructive'}>{result.multiplier.toFixed(2)}x</Badge>
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
