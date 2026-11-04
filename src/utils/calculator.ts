// src/utils/calculator.ts — Utilitário de parsing e avaliação matemática segura para a calculadora
export type MathOperator = '+' | '−' | '×' | '÷'

export type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }

/**
 * Converte expressão com símbolos amigáveis (÷, ×, −, vírgula) em tokens
 */
export function tokenize(expr: string): Token[] | null {
  const clean = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .trim()

  if (!clean) return null

  const tokens: Token[] = []
  let i = 0

  while (i < clean.length) {
    const char = clean[i]

    if (char === ' ') {
      i++
      continue
    }

    const isOperator = ['+', '-', '*', '/'].includes(char)
    if (isOperator) {
      const prevToken = tokens[tokens.length - 1]
      const isUnary = !prevToken || prevToken.type === 'operator'

      if (isUnary && (char === '-' || char === '+')) {
        let numStr = char
        i++
        while (i < clean.length && ((clean[i] >= '0' && clean[i] <= '9') || clean[i] === '.')) {
          numStr += clean[i]
          i++
        }
        if (numStr === '-' || numStr === '+') {
          return null
        }
        const num = parseFloat(numStr)
        if (isNaN(num)) return null
        tokens.push({ type: 'number', value: num })
        continue
      } else {
        tokens.push({ type: 'operator', value: char as '+' | '-' | '*' | '/' })
        i++
        continue
      }
    }

    if ((char >= '0' && char <= '9') || char === '.') {
      let numStr = ''
      while (i < clean.length && ((clean[i] >= '0' && clean[i] <= '9') || clean[i] === '.')) {
        numStr += clean[i]
        i++
      }
      const num = parseFloat(numStr)
      if (isNaN(num)) return null
      tokens.push({ type: 'number', value: num })
      continue
    }

    return null
  }

  return tokens
}

/**
 * Avalia tokens respeitando a ordem de precedência matemática (* e / antes de + e -)
 */
export function evaluateTokens(tokens: Token[]): number | null {
  if (!tokens || tokens.length === 0) return null

  // Se a expressão terminar com operador pendente, desconsidera o último para avaliação em tempo real
  const workingTokens = [...tokens]
  while (workingTokens.length > 0 && workingTokens[workingTokens.length - 1].type === 'operator') {
    workingTokens.pop()
  }

  if (workingTokens.length === 0) return null

  // 1º passo: Multiplicações (*) e Divisões (/)
  const intermediate: Token[] = []
  let i = 0
  while (i < workingTokens.length) {
    const token = workingTokens[i]
    if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
      const prev = intermediate.pop()
      const next = workingTokens[i + 1]
      if (!prev || prev.type !== 'number' || !next || next.type !== 'number') {
        return null
      }
      if (token.value === '/' && next.value === 0) {
        return null // Divisão por zero
      }
      const res = token.value === '*' ? prev.value * next.value : prev.value / next.value
      intermediate.push({ type: 'number', value: res })
      i += 2
    } else {
      intermediate.push(token)
      i++
    }
  }

  // 2º passo: Adições (+) e Subtrações (-)
  if (intermediate.length === 0) return null
  if (intermediate[0].type !== 'number') return null

  let total = intermediate[0].value as number
  let j = 1
  while (j < intermediate.length) {
    const opToken = intermediate[j]
    const nextToken = intermediate[j + 1]
    if (!opToken || opToken.type !== 'operator' || !nextToken || nextToken.type !== 'number') {
      return null
    }
    if (opToken.value === '+') {
      total += nextToken.value
    } else if (opToken.value === '-') {
      total -= nextToken.value
    }
    j += 2
  }

  return Math.round(total * 10000) / 10000
}

/**
 * Avalia uma expressão matemática string completa
 */
export function evaluateMathExpression(expr: string): number | null {
  const tokens = tokenize(expr)
  if (!tokens) return null
  return evaluateTokens(tokens)
}

/**
 * Localiza o último número digitado no fim da expressão
 */
export function getLastNumberRange(expr: string): { start: number; end: number; text: string } | null {
  const match = expr.match(/(-?[\d,.]+)$/)
  if (!match || match.index === undefined) return null
  return {
    start: match.index,
    end: expr.length,
    text: match[1],
  }
}

/**
 * Inverte o sinal (+ / -) do último número digitado
 */
export function toggleSign(expr: string): string {
  const range = getLastNumberRange(expr)
  if (!range) {
    if (expr === '' || expr === '0') return '-'
    if (expr.endsWith(' ')) return expr + '-'
    return expr
  }

  let newText: string
  if (range.text.startsWith('-')) {
    newText = range.text.slice(1)
  } else {
    newText = '-' + range.text
  }

  return expr.slice(0, range.start) + newText
}

/**
 * Aplica porcentagem inteligente:
 * Ex: "200 + 10%" => "200 + 20" (10% de 200 é 20)
 * Ex: "200 - 15%" => "200 - 30"
 * Ex: "50%" => "0,5"
 */
export function applyPercentage(expr: string): string {
  const range = getLastNumberRange(expr)
  if (!range) return expr

  const currentNumber = parseFloat(range.text.replace(',', '.'))
  if (isNaN(currentNumber)) return expr

  const prefix = expr.slice(0, range.start).trim()
  if (!prefix) {
    // Apenas um número: divide por 100
    const pct = currentNumber / 100
    return pct.toString().replace('.', ',')
  }

  // Verifica o operador anterior
  const lastChar = prefix[prefix.length - 1]
  const prevExpression = prefix.slice(0, -1).trim()
  const prevVal = evaluateMathExpression(prevExpression)

  if (prevVal !== null && (lastChar === '+' || lastChar === '−' || lastChar === '-')) {
    const pctVal = (prevVal * currentNumber) / 100
    const rounded = Math.round(pctVal * 100) / 100
    return expr.slice(0, range.start) + rounded.toString().replace('.', ',')
  }

  // Operação de multiplicação ou divisão
  const pct = currentNumber / 100
  return expr.slice(0, range.start) + pct.toString().replace('.', ',')
}

/**
 * Adiciona um dígito (0-9) à expressão
 */
export function appendDigit(expr: string, digit: string, isNewEntry: boolean): string {
  if (isNewEntry || expr === '0') {
    return digit
  }
  return expr + digit
}

/**
 * Adiciona separador decimal (vírgula) à expressão
 */
export function appendDecimal(expr: string, isNewEntry: boolean): string {
  if (isNewEntry || expr === '') {
    return '0,'
  }

  const range = getLastNumberRange(expr)
  if (!range) {
    if (expr.endsWith(' ')) {
      return expr + '0,'
    }
    return expr + '0,'
  }

  if (range.text.includes(',') || range.text.includes('.')) {
    return expr // Já possui vírgula
  }

  return expr + ','
}

/**
 * Adiciona um operador matemático (+, −, ×, ÷)
 */
export function appendOperator(expr: string, op: MathOperator): string {
  if (!expr || expr === '0') {
    if (op === '−') return '-'
    return `0 ${op} `
  }

  // Se já termina com um operador rodeado de espaços (ex: " + "), substitui pelo novo
  if (/\s[+−×÷]\s$/.test(expr)) {
    return expr.replace(/\s[+−×÷]\s$/, ` ${op} `)
  }

  // Se termina com vírgula, remove a vírgula antes de adicionar o operador
  if (expr.endsWith(',')) {
    return `${expr.slice(0, -1)} ${op} `
  }

  return `${expr} ${op} `
}

/**
 * Apaga o último caractere ou operador
 */
export function backspace(expr: string): string {
  if (!expr || expr === '0') return '0'

  if (/\s[+−×÷]\s$/.test(expr)) {
    const next = expr.slice(0, -3)
    return next || '0'
  }

  const next = expr.slice(0, -1).trimEnd()
  return next || '0'
}
