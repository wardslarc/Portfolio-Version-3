import { Bricolage_Grotesque, Caveat, Instrument_Serif } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bricolage",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic"],
  display: "swap",
  variable: "--font-instrument",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-caveat",
});

export const homeFontVariables = `${bricolage.variable} ${instrument.variable} ${caveat.variable}`;
