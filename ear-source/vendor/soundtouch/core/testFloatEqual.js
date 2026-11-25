export default function isFloatDifferent(a, b) {
    return (a > b ? a - b : b - a) > 1e-10;
}
