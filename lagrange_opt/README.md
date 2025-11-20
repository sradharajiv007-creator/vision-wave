# Lagrange Multiplier-Based Wireless Network Optimizer (C Engine)

## Overview

This C program implements a Lagrange Multiplier-based optimization solver for wireless network parameters to minimize latency.

## Objective Function

Minimize: **L(x₁, x₂, x₃) = a/x₁ + b/x₂ + c/x₃**

Where:
- **x₁** = Data Rate (Mbps)
- **x₂** = Transmission Power (W)
- **x₃** = Bandwidth (MHz)

## Constraints

- **g₁**: x₁ ≥ R_min (minimum data rate)
- **g₂**: x₂ ≤ P_max (maximum transmission power)
- **g₃**: x₃ ≤ B_max (maximum bandwidth)

## Building

### Linux/macOS:
```bash
cd lagrange_opt
make
```

### Windows (MinGW/MSYS2):
```bash
cd lagrange_opt
gcc -Wall -O2 -o optimizer.exe optimizer.c -lm
```

## Usage

```bash
./optimizer <R_min> <P_max> <B_max> <a> <b> <c>
```

### Example:
```bash
./optimizer 5.0 2.5 20.0 1.2 0.8 0.5
```

### Output:
JSON format with optimized values:
```json
{
  "rate": 6.2341,
  "power": 2.1234,
  "bandwidth": 18.5678,
  "latency": 0.452341
}
```

## Algorithm

1. Initialize variables to feasible starting points
2. Iteratively update using gradient descent with Lagrange multipliers
3. Project onto feasible region (apply constraints)
4. Check convergence (change < 0.001)
5. Return optimized values

## Integration

The backend API (`api/optimize.js`) can execute this C program via child process when available, falling back to JavaScript implementation for serverless environments.

