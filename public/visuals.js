/**
 * TSAP Club Visual Effects
 * Theme: Space & Neon
 */

class Starfield {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.numStars = 200;
        this.speed = 0.5;
        this.colors = ['#ffffff', '#06b6d4', '#8b5cf6']; // White, Cyan, Violet

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.init();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                z: Math.random() * 2 + 0.5, // Depth/Size
                opacity: Math.random(),
                pulseSpeed: Math.random() * 0.02 + 0.005,
                color: this.colors[Math.floor(Math.random() * this.colors.length)]
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];

            // Move up slowly
            star.y -= this.speed * star.z;

            // Reset if off screen
            if (star.y < 0) {
                star.y = this.canvas.height;
                star.x = Math.random() * this.canvas.width;
            }

            // Pulse opacity
            star.opacity += star.pulseSpeed;
            if (star.opacity > 1 || star.opacity < 0.2) star.pulseSpeed *= -1;

            // Draw
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.z, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = Math.max(0, Math.min(1, star.opacity));
            this.ctx.fill();

            // Glow for larger stars
            if (star.z > 1.5) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = star.color;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        }

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Only init if canvas exists
    if (document.getElementById('matrixCanvas')) {
        new Starfield('matrixCanvas');
    }
});
