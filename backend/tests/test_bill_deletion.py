import sys
import unittest
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.models import (
    BillDefaultSplitParticipantTable, BillItemSplitTable, BillItemTable,
    BillParticipantTable, BillTable, KitchenMembershipTable, KitchenTable, UserTable,
)
from app.routers.bills import create_bill, delete_bill, update_bill
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


if __name__ == '__main__':
    unittest.main()
