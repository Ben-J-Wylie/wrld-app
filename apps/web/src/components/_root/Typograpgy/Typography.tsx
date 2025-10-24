import React from "react";
import "../../_main/main.css";

type BrandColor = "primary" | "secondary" | "tertiary" | "accent";

type Props = {
  sample?: string;
  colors?: BrandColor[];
};

const DEFAULT_SAMPLE = "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG";

const TypographyDemo: React.FC<Props> = ({
  sample = DEFAULT_SAMPLE,
  colors = ["primary", "secondary", "tertiary", "accent"],
}) => {
  return (
    <div>
      {colors.map((color) => (
        <section key={color} className="container">
          <header
            style={{ color: `var(--color-${color})`, marginBottom: "1rem" }}
          >
            {color.toUpperCase()}
          </header>

          <div className="grid">
            {/* h1 */}
            <div>
              <label>h1</label>
              <h1 style={{ color: `var(--color-${color})` }}>
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </h1>
            </div>

            {/* h2 */}
            <div>
              <label>h2</label>
              <h2 style={{ color: `var(--color-${color})` }}>
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </h2>
            </div>

            {/* h3 */}
            <div>
              <label>h3</label>
              <h3 style={{ color: `var(--color-${color})` }}>
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </h3>
            </div>

            {/* p */}
            <div>
              <label>p</label>
              <p style={{ color: `var(--color-${color})` }}>
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </p>
            </div>

            {/* Bold */}
            <div>
              <label>Bold</label>
              <p
                style={{
                  color: `var(--color-${color})`,
                  fontWeight: "bold",
                }}
              >
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </p>
            </div>

            {/* Italic */}
            <div>
              <label>Italic</label>
              <p
                style={{
                  color: `var(--color-${color})`,
                  fontStyle: "italic",
                }}
              >
                {sample}
                <br />
                <br />
                {sample.toLowerCase()}
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default TypographyDemo;
