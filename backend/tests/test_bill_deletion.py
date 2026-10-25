import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.models import (
    BillDefaultSplitParticipantTable, BillItemSplitTable, BillItemTable,
    BillParticipantTable, BillTable, KitchenMembershipTable, KitchenTable, UserTable,
)
from app.routers.bills import create_bill, delete_bill, list_bills, update_bill
from app.schemas.bill import BillPayload


class BillDeletionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', poolclass=StaticPool)
        @event.listens_for(self.engine, 'connect')
        def enable_foreign_keys(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)
        self.user = UserTable(email='owner@example.test', username='Owner', password_hash='unused')
        self.session.add(self.user)
        self.session.commit()
        self.kitchen = KitchenTable(name='Test kitchen', created_by_user_id=self.user.id)
        self.session.add(self.kitchen)
        self.session.commit()
        self.session.add(KitchenMembershipTable(kitchen_id=self.kitchen.id, user_id=self.user.id, role='owner'))
        self.session.commit()

    def payload(self, count, store='Shop'):
        return BillPayload(date='2026-10-25', store=store, participants=['Owner'], defaultPayer='Owner',
                           defaultSplit={'type': 'all', 'between': ['Owner']},
                           items=[{'name': f'Item {index}', 'price': 1, 'paidBy': 'Owner',
                                   'splitType': 'all', 'splitBetween': ['Owner']} for index in range(count)])

    def create(self, count):
        return create_bill(self.kitchen.id, self.payload(count), self.user, self.session)['tripId']

    def test_delete_query_count_stays_constant_and_other_bills_survive(self):
        other = self.create(1)
        query_counts = []
        for count in [1, 100]:
            bill_id = self.create(count)
            kitchen_id = self.kitchen.id
            self.user.id  # Load the expired user before measuring the handler.
            statements = []
            def record(_connection, _cursor, statement, _parameters, _context, _many):
                statements.append(statement)
            event.listen(self.engine, 'before_cursor_execute', record)
            try:
                delete_bill(kitchen_id, bill_id, self.user, self.session)
            finally:
                event.remove(self.engine, 'before_cursor_execute', record)
            query_counts.append(len(statements))
            self.assertEqual(sum(sql.lstrip().upper().startswith('DELETE') for sql in statements), 5)
            self.assertIsNone(self.session.get(BillTable, bill_id))
            self.assertIsNotNone(self.session.get(BillTable, other))
            for model in [BillDefaultSplitParticipantTable, BillParticipantTable, BillItemTable, BillItemSplitTable]:
                self.assertEqual(len(self.session.exec(select(model)).all()), 1)
        self.assertEqual(query_counts[0], query_counts[1])
        self.assertLessEqual(query_counts[1], 8)

    def test_edit_replaces_children_after_bulk_cleanup(self):
        bill_id = self.create(3)
        result = update_bill(self.kitchen.id, bill_id, self.payload(2, 'Updated shop'), self.user, self.session)
        self.assertEqual(result['trip']['store'], 'Updated shop')
        self.assertEqual(len(result['trip']['items']), 2)
        self.assertEqual(len(self.session.exec(select(BillItemSplitTable)).all()), 2)

    def test_list_query_count_stays_constant_as_bills_and_items_grow(self):
        first_id = self.create(1)
        query_counts = []
        for extra_bills in [0, 29]:
            for _ in range(extra_bills):
                self.create(4)
            kitchen_id = self.kitchen.id
            user_id = self.user.id
            self.session.expire_all()
            user = self.session.get(UserTable, user_id)
            statements = []
            def record(_connection, _cursor, statement, _parameters, _context, _many):
                statements.append(statement)
            event.listen(self.engine, 'before_cursor_execute', record)
            try:
                result = list_bills(kitchen_id, False, user, self.session)
            finally:
                event.remove(self.engine, 'before_cursor_execute', record)
            query_counts.append(len(statements))
            first = next(trip for trip in result['trips'] if trip['id'] == first_id)
            self.assertEqual(first, {
                'dbTripId': first_id, 'id': first_id, 'date': '2026-10-25', 'store': 'Shop',
                'participants': ['Owner'], 'defaultPayer': 'Owner',
                'defaultSplit': {'type': 'all', 'between': ['Owner']},
                'items': [{'name': 'Item 0', 'price': 1.0, 'paidBy': 'Owner',
                           'splitType': 'all', 'splitBetween': ['Owner']}],
                'status': 'open', 'settlementResults': [],
            })
        self.assertEqual(len(result['trips']), 30)
        self.assertEqual(query_counts, [8, 8])

    def test_save_uses_one_commit_and_applies_food_preferences(self):
        self.user.avoided_foods = '["peanut"]'
        self.session.add(self.user)
        self.session.commit()
        second = UserTable(email='second@example.test', username='Second', password_hash='unused')
        self.session.add(second)
        self.session.commit()
        self.session.add(KitchenMembershipTable(kitchen_id=self.kitchen.id, user_id=second.id, role='member'))
        self.session.commit()
        payload = self.payload(10)
        payload.participants.append('Second')
        payload.defaultSplit.between.append('Second')
        payload.items[0].name = 'Peanut butter'
        for item in payload.items:
            item.splitBetween.append('Second')
        with patch.object(self.session, 'commit', wraps=self.session.commit) as commit:
            result = create_bill(self.kitchen.id, payload, self.user, self.session)
            self.assertEqual(commit.call_count, 1)
        self.assertEqual(result['trip']['items'][0]['splitBetween'], ['Second'])
        self.assertEqual(result['trip']['items'][1]['splitBetween'], ['Owner', 'Second'])
        self.assertEqual(result['trip']['settlementResults'], [{'from': 'Second', 'to': 'Owner', 'amount': 5.5}])
        self.assertEqual(list_bills(self.kitchen.id, True, second, self.session), {'trips': []})

    def test_invalid_edit_rolls_back_without_losing_saved_items(self):
        bill_id = self.create(3)
        payload = self.payload(2)
        payload.items[-1].paidBy = 'Unknown payer'
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):
            update_bill(self.kitchen.id, bill_id, payload, self.user, self.session)
        self.session.rollback()
        result = list_bills(self.kitchen.id, False, self.user, self.session)
        self.assertEqual(len(result['trips'][0]['items']), 3)


if __name__ == '__main__':
    unittest.main()
