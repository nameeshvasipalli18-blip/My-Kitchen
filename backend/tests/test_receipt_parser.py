import unittest

from app.ocr.paddle_ocr_service import _reading_order
from app.ocr.receipt_parser import parse_receipt


class ReceiptParserTests(unittest.TestCase):
    def test_parses_quantity_weighted_items_and_total(self):
        result = parse_receipt([
            "15 Free Range Eggs 2 x £2.89 5.78 A",
            "Chillies 0080632 2 x £0.79 1.58 A",
            "Bananas Loose",
            "2.326 kg @ £0.90/kg",
            "2.09",
            "TOTAL 9.45",
            "CARD 9.45",
        ])

        self.assertEqual(result["items"], [
            {"name": "Free Range Eggs", "price": 5.78},
            {"name": "Chillies", "price": 1.58},
            {"name": "Bananas Loose", "price": 2.09},
        ])
        self.assertEqual(result["total"], 9.45)
        self.assertEqual(result["calculated_total"], 9.45)
        self.assertTrue(result["total_matches"])

    def test_does_not_turn_summary_lines_into_items(self):
        result = parse_receipt([
            "Milk 1.65 A",
            "Subtotal 1.65",
            "Discount 0.25",
            "TOTAL 1.40",
            "Cash 1.40",
            "Change 0.00",
        ])

        self.assertEqual(result["items"], [{"name": "Milk", "price": 1.65}])
        self.assertEqual(result["total"], 1.4)
        self.assertFalse(result["total_matches"])

    def test_orders_ocr_lines_using_their_positions(self):
        lines = _reading_order([
            {"text": "2.326 kg @ £0.90/kg", "box": [[40, 120], [300, 120], [300, 140], [40, 140]]},
            {"text": "Bananas Loose 0080000 2.09 A", "box": [[40, 90], [380, 90], [380, 110], [40, 110]]},
            {"text": "TOTAL 2.09", "box": [[40, 160], [200, 160], [200, 180], [40, 180]]},
        ])

        self.assertEqual([line["text"] for line in lines], [
            "Bananas Loose 0080000 2.09 A",
            "2.326 kg @ £0.90/kg",
            "TOTAL 2.09",
        ])

    def test_rebuilds_split_receipt_columns_before_parsing(self):
        ocr_lines = _reading_order([
            {"text": "15 Free Range Eggs 2", "confidence": 0.99, "box": [[20, 20], [260, 20], [260, 40], [20, 40]]},
            {"text": "x £2.89", "confidence": 0.98, "box": [[270, 20], [340, 20], [340, 40], [270, 40]]},
            {"text": "5.78 A", "confidence": 0.99, "box": [[400, 20], [460, 20], [460, 40], [400, 40]]},
        ])

        self.assertEqual(ocr_lines[0]["text"], "15 Free Range Eggs 2 x £2.89 5.78 A")
        self.assertEqual(parse_receipt(ocr_lines)["items"], [{"name": "Free Range Eggs", "price": 5.78}])

    def test_keeps_nearby_receipt_rows_separate(self):
        ocr_lines = _reading_order([
            {"text": "Free Range Eggs 2", "box": [[20, 20], [240, 20], [240, 40], [20, 40]]},
            {"text": "x £2.89", "box": [[250, 20], [320, 20], [320, 40], [250, 40]]},
            {"text": "5.78 A", "box": [[390, 20], [450, 20], [450, 40], [390, 40]]},
            {"text": "Chillies 2", "box": [[20, 42], [160, 42], [160, 62], [20, 62]]},
            {"text": "x £0.79", "box": [[250, 42], [320, 42], [320, 62], [250, 62]]},
            {"text": "1.58 A", "box": [[390, 42], [450, 42], [450, 62], [390, 62]]},
        ])

        self.assertEqual([line["text"] for line in ocr_lines], [
            "Free Range Eggs 2 x £2.89 5.78 A",
            "Chillies 2 x £0.79 1.58 A",
        ])
        self.assertEqual(parse_receipt(ocr_lines)["items"], [
            {"name": "Free Range Eggs", "price": 5.78},
            {"name": "Chillies", "price": 1.58},
        ])

    def test_uses_quantity_and_unit_price_when_ocr_truncates_final_price(self):
        result = parse_receipt([
            "Free Range Eggs 2 x£2.89 5.7",
            "Chillies 2 x £0.79 1.5",
            "Cola Maxx 4 x £0.49 1.",
        ])

        self.assertEqual(result["items"], [
            {"name": "Free Range Eggs", "price": 5.78},
            {"name": "Chillies", "price": 1.58},
            {"name": "Cola Maxx", "price": 1.96},
        ])