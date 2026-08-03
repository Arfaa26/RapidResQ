import 'package:flutter_test/flutter_test.dart';

import 'package:rapidresq/main.dart';

void main() {
  testWidgets('RapidResQ app builds', (WidgetTester tester) async {
    await tester.pumpWidget(const RapidResQApp());
    await tester.pump();

    expect(find.byType(RapidResQApp), findsOneWidget);
  });
}
