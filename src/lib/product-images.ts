import pilau from "@/assets/products/pilau.jpg";
import beefStew from "@/assets/products/beef-stew.jpg";
import ugaliSukuma from "@/assets/products/ugali-sukuma.jpg";
import chickenChips from "@/assets/products/chicken-chips.jpg";
import biryani from "@/assets/products/biryani.jpg";
import samosa from "@/assets/products/samosa.jpg";
import chai from "@/assets/products/chai.jpg";
import juice from "@/assets/products/juice.jpg";
import coffee from "@/assets/products/coffee.jpg";
import githeri from "@/assets/products/githeri.jpg";
import breakfast from "@/assets/products/breakfast.jpg";
import fish from "@/assets/products/fish.jpg";

export const productImages: Record<string, string> = {
  pilau,
  "beef-stew": beefStew,
  "ugali-sukuma": ugaliSukuma,
  "chicken-chips": chickenChips,
  biryani,
  samosa,
  chai,
  juice,
  coffee,
  githeri,
  breakfast,
  fish,
};

export function productImage(key?: string) {
  return key ? productImages[key] : undefined;
}
