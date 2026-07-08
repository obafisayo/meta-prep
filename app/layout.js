import "./globals.css";

export const metadata = {
  title: "Meta PE + Amazon SDE Prep",
  description: "62-day Meta Production Engineer + Amazon SDE Intern interview prep tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
