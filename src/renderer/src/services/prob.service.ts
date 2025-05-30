/* eslint-disable prettier/prettier */
export type Difficulty = 'easy' | 'normal' | 'hard';

interface DifficultyProbabilities {
    level: Difficulty;
    probs: number[];
}

class ProbabilityService {
    randomWithProbabilities(probs: number[]): number {
        const totalProb = probs.reduce((acc, prob) => acc + prob, 0);

        if (Math.abs(totalProb - 1) > 1e-10) {
            throw new Error('A soma das probabilidades deve ser igual a 1.');
        }

        const rand = Math.random();
        let cumulativeProb = 0;

        for (let i = 0; i < probs.length; i++) {
            cumulativeProb += probs[i];
            if (rand < cumulativeProb) {
                return i;
            }
        }

        return probs.length - 1;
    }

    probabilityCreator(max?: number, probabilities?: number[]): number {
        max = max ?? 100;
        const probs = probabilities ?? [0.6, 0.2, 0.15, 0.05];

        const randomInt = this.randomWithProbabilities(probs);

        if (randomInt === probs.length - 1) {
            const baseValue = 10 + Math.random() * max;
            return parseFloat(baseValue.toFixed(2));
        }

        const baseValue = randomInt + 1;
        const randomDecimal = Math.random();
        const result = baseValue + randomDecimal;

        return parseFloat(result.toFixed(2));
    }

    createBatchProbability(max: number, probabilities?: number[]): number[] {
        const results = Array.from({ length: 20 }, () => this.probabilityCreator(max, probabilities));
        return results;
    }

    difficultProbabilityCreator(difficulty: Difficulty): number[] {
        const probs: DifficultyProbabilities[] = [
            { level: 'easy', probs: [0.3, 0.3, 0.2, 0.2] },
            { level: 'normal', probs: [0.6, 0.2, 0.15, 0.05] },
            { level: 'hard', probs: [0.75, 0.15, 0.08, 0.02] },
        ];

        const selectedProbs = probs.find((p) => p.level === difficulty)?.probs;
        if (!selectedProbs) {
            throw new Error('Dificuldade inválida. Use "easy", "normal" ou "hard".');
        }

        return selectedProbs;
    }
}

export const probabilityService = new ProbabilityService();
