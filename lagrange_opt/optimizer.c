/*
 * Lagrange Multiplier-Based Wireless Network Optimization
 * 
 * Objective: Minimize Latency L(x1, x2, x3) = a/x1 + b/x2 + c/x3
 * 
 * Constraints:
 *   g1: x1 >= R_min  (minimum data rate)
 *   g2: x2 <= P_max  (maximum transmission power)
 *   g3: x3 <= B_max  (maximum bandwidth)
 * 
 * Method: Lagrange Multiplier with iterative numerical solver
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_ITERATIONS 1000
#define CONVERGENCE_THRESHOLD 0.001
#define STEP_SIZE 0.01

typedef struct {
    double rate;      // x1
    double power;     // x2
    double bandwidth; // x3
    double latency;
} OptimizationResult;

// Objective function: L = a/x1 + b/x2 + c/x3
double objective(double x1, double x2, double x3, double a, double b, double c) {
    return a / x1 + b / x2 + c / x3;
}

// Constraint functions
double g1(double x1, double r_min) {
    return x1 - r_min;  // x1 >= R_min
}

double g2(double x2, double p_max) {
    return p_max - x2;  // x2 <= P_max
}

double g3(double x3, double b_max) {
    return b_max - x3;  // x3 <= B_max
}

// Partial derivatives of objective function
void gradient(double x1, double x2, double x3, double a, double b, double c,
              double *grad_x1, double *grad_x2, double *grad_x3) {
    *grad_x1 = -a / (x1 * x1);
    *grad_x2 = -b / (x2 * x2);
    *grad_x3 = -c / (x3 * x3);
}

// Lagrange Multiplier Method Solver
OptimizationResult solve_lagrange(double r_min, double p_max, double b_max,
                                  double a, double b, double c) {
    OptimizationResult result = {0};
    
    // Initialize variables (start from feasible point)
    double x1 = r_min + 1.0;  // Ensure x1 > R_min
    double x2 = p_max * 0.8;   // Start below P_max
    double x3 = b_max * 0.8;   // Start below B_max
    
    // Initialize Lagrange multipliers (lambda >= 0 for inequality constraints)
    double lambda1 = 0.0;  // For g1: x1 >= R_min
    double lambda2 = 0.0;  // For g2: x2 <= P_max
    double lambda3 = 0.0;  // For g3: x3 <= B_max
    
    double prev_latency = INFINITY;
    
    for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
        // Compute gradients
        double grad_x1, grad_x2, grad_x3;
        gradient(x1, x2, x3, a, b, c, &grad_x1, &grad_x2, &grad_x3);
        
        // Compute constraint values
        double g1_val = g1(x1, r_min);
        double g2_val = g2(x2, p_max);
        double g3_val = g3(x3, b_max);
        
        // Update Lagrange multipliers (only if constraint is active)
        if (g1_val < 0) lambda1 = fmax(0, lambda1 - STEP_SIZE * g1_val);
        else lambda1 = 0;
        
        if (g2_val < 0) lambda2 = fmax(0, lambda2 - STEP_SIZE * g2_val);
        else lambda2 = 0;
        
        if (g3_val < 0) lambda3 = fmax(0, lambda3 - STEP_SIZE * g3_val);
        else lambda3 = 0;
        
        // Update variables using gradient descent with Lagrange multipliers
        // dL/dx1 = grad_x1 + lambda1 (for g1: x1 >= R_min, so +lambda1)
        // dL/dx2 = grad_x2 - lambda2 (for g2: x2 <= P_max, so -lambda2)
        // dL/dx3 = grad_x3 - lambda3 (for g3: x3 <= B_max, so -lambda3)
        
        double new_x1 = x1 - STEP_SIZE * (grad_x1 + lambda1);
        double new_x2 = x2 - STEP_SIZE * (grad_x2 - lambda2);
        double new_x3 = x3 - STEP_SIZE * (grad_x3 - lambda3);
        
        // Apply constraints (project onto feasible region)
        new_x1 = fmax(new_x1, r_min);
        new_x2 = fmin(new_x2, p_max);
        new_x3 = fmin(new_x3, b_max);
        
        // Check convergence
        double current_latency = objective(new_x1, new_x2, new_x3, a, b, c);
        if (fabs(prev_latency - current_latency) < CONVERGENCE_THRESHOLD) {
            x1 = new_x1;
            x2 = new_x2;
            x3 = new_x3;
            break;
        }
        
        x1 = new_x1;
        x2 = new_x2;
        x3 = new_x3;
        prev_latency = current_latency;
    }
    
    result.rate = x1;
    result.power = x2;
    result.bandwidth = x3;
    result.latency = objective(x1, x2, x3, a, b, c);
    
    return result;
}

// Validate input constraints
int validate_inputs(double r_min, double p_max, double b_max, double a, double b, double c) {
    if (r_min <= 0 || p_max <= 0 || b_max <= 0) return 0;
    if (a <= 0 || b <= 0 || c <= 0) return 0;
    if (r_min >= b_max * 10) return 0;  // Unrealistic constraint
    return 1;
}

int main(int argc, char *argv[]) {
    if (argc != 7) {
        fprintf(stderr, "Usage: %s <R_min> <P_max> <B_max> <a> <b> <c>\n", argv[0]);
        fprintf(stderr, "Example: %s 5.0 2.5 20.0 1.2 0.8 0.5\n", argv[0]);
        return 1;
    }
    
    double r_min = atof(argv[1]);
    double p_max = atof(argv[2]);
    double b_max = atof(argv[3]);
    double a = atof(argv[4]);
    double b = atof(argv[5]);
    double c = atof(argv[6]);
    
    if (!validate_inputs(r_min, p_max, b_max, a, b, c)) {
        fprintf(stderr, "ERROR: Invalid input constraints\n");
        return 1;
    }
    
    OptimizationResult result = solve_lagrange(r_min, p_max, b_max, a, b, c);
    
    // Output JSON format for backend parsing
    printf("{\n");
    printf("  \"rate\": %.4f,\n", result.rate);
    printf("  \"power\": %.4f,\n", result.power);
    printf("  \"bandwidth\": %.4f,\n", result.bandwidth);
    printf("  \"latency\": %.6f\n", result.latency);
    printf("}\n");
    
    return 0;
}

